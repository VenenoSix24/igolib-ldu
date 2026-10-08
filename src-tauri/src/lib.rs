use reqwest::redirect::Policy;
use std::collections::HashSet;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_log::{FileOpenStrategy, RotationStrategy, Target, TargetKind, TimezoneStrategy};
use tauri_plugin_opener::OpenerExt;

/// 日志文件名（不含扩展名），需与 tauri-plugin-log 的 LogDir target 保持一致
const LOG_FILE_NAME: &str = "igolib";
/// 单个日志文件上限，超出后按 RotationStrategy 轮转
const LOG_MAX_FILE_SIZE: u128 = 4 * 1024 * 1024;
/// 保留的历史日志份数（配合上限，日志目录最大占用约 LOG_MAX_FILE_SIZE * LOG_KEEP_FILES）
const LOG_KEEP_FILES: usize = 3;
/// 读取单个日志文件时最多读取的尾部字节数，日志越新越重要
const LOG_TAIL_LIMIT: u64 = 1024 * 1024;
/// 单份诊断报告的体积上限，避免导出一个大到无法发送的文本
const REPORT_LIMIT: u64 = 2 * 1024 * 1024;
/// 日志文件扩展名
const LOG_EXTENSION: &str = "log";

/// 从微信回调链接中获取 Cookie
#[tauri::command]
async fn exchange_cookie(auth_url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let mut cookies_set = HashSet::new();

    // 1. 先访问根域名，获取初始网关分发的 Cookie（wechatSESS_ID）
    if let Ok(parsed_url) = reqwest::Url::parse(&auth_url) {
        if let Some(host) = parsed_url.host_str() {
            let base_url = format!("{}://{}/", parsed_url.scheme(), host);
            if let Ok(base_res) = client.get(&base_url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090719) XWEB/8391 Flue")
                .send()
                .await 
            {
                for full_cookie in base_res.headers().get_all("set-cookie").iter().filter_map(|v| v.to_str().ok()) {
                    let kv = full_cookie.split(';').next().unwrap_or("").trim().to_string();
                    if !kv.is_empty() {
                        cookies_set.insert(kv);
                    }
                }
                log::info!("[auth] 根域预请求完成: status={}, 累计 Cookie 项={}", base_res.status(), cookies_set.len());
            }
        }
    }

    // 2. 访问认证网关 auth.html 获取身份型 Cookie（Authorization, SERVERID）
    let response = client
        .get(&auth_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090719) XWEB/8391 Flue")
        .header("Accept", "*/*")
        .send()
        .await
        .map_err(|e| format!("请求发送失败: {}", e))?;

    log::info!("[auth] 认证网关响应: status={}", response.status());

    for full_cookie in response.headers().get_all("set-cookie").iter().filter_map(|v| v.to_str().ok()) {
        let kv = full_cookie.split(';').next().unwrap_or("").trim().to_string();
        if !kv.is_empty() && (!kv.starts_with("SERVERID=") || !cookies_set.iter().any(|c: &String| c.starts_with("SERVERID="))) {
            let key = kv.split('=').next().unwrap_or("").to_string();
            cookies_set.retain(|c| !c.starts_with(&key));
            cookies_set.insert(kv);
        }
    }

    if cookies_set.is_empty() {
        log::warn!("[auth] 服务器未返回 Cookie，链接可能已过期");
        return Err("服务器未返回 Cookie，请检查链接是否已过期。".to_string());
    }

    let mut cookie_list: Vec<String> = cookies_set.into_iter().collect();
    cookie_list.sort();

    // 只记录 Cookie 的键名，值属于凭据不落盘
    let cookie_keys: Vec<&str> = cookie_list.iter().map(|c| c.split('=').next().unwrap_or("")).collect();
    log::info!("[auth] Cookie 提取成功: 项={:?}", cookie_keys);

    Ok(cookie_list.join("; "))
}

// ---------------------------------------------------------------------------
// 诊断日志：让用户在一键导出日志，替代"只能发截图"的排障方式
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct LogFileInfo {
    name: String,
    size: u64,
    modified_ms: Option<u64>,
}

#[derive(Serialize)]
struct DiagInfo {
    app_version: String,
    app_name: String,
    identifier: String,
    os: String,
    arch: String,
    family: String,
    tauri_version: String,
    log_dir: String,
    log_files: Vec<LogFileInfo>,
}

/// 日志目录（与 tauri-plugin-log 的 LogDir target 解析结果一致）
fn log_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("无法定位日志目录: {}", e))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("无法创建日志目录: {}", e))?;
    }
    Ok(dir)
}

/// 列出日志目录下的所有日志文件，按修改时间从旧到新排序
fn collect_log_files(dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<(PathBuf, u64)> = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() || path.extension().and_then(|e| e.to_str()) != Some(LOG_EXTENSION) {
                continue;
            }
            let modified = fs::metadata(&path)
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            files.push((path, modified));
        }
    }

    files.sort_by_key(|(_, modified)| *modified);
    files.into_iter().map(|(path, _)| path).collect()
}

/// 读取文件内容；超过 limit 时只保留尾部，并在开头标注被省略
fn read_tail(path: &Path, limit: u64) -> std::io::Result<String> {
    let mut file = fs::File::open(path)?;
    let length = file.metadata()?.len();
    let truncated = length > limit;

    if truncated {
        file.seek(SeekFrom::Start(length - limit))?;
    }

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    let mut text = String::from_utf8_lossy(&buffer).into_owned();
    if truncated {
        text.insert_str(0, "…（该文件较早内容已省略，仅保留最近部分）\n");
    }
    Ok(text)
}

fn read_all_logs(app: &tauri::AppHandle) -> Result<String, String> {
    let dir = log_dir(app)?;
    let mut files = collect_log_files(&dir);
    if files.is_empty() {
        return Ok("(暂无日志文件)".to_string());
    }

    // 新的日志在前，保证报告优先完整包含最近一次出问题的记录
    files.reverse();

    let mut output = String::new();
    let mut dropped_older = false;

    for path in files {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(LOG_EXTENSION)
            .to_string();

        let body = match read_tail(&path, LOG_TAIL_LIMIT) {
            Ok(text) => text,
            Err(e) => format!("(读取失败: {})\n", e),
        };

        let section = format!("\n===== {} =====\n{}", name, body);
        if !output.is_empty() && output.len() as u64 + section.len() as u64 > REPORT_LIMIT {
            dropped_older = true;
            break;
        }

        output.push_str(&section);
        if !output.ends_with('\n') {
            output.push('\n');
        }
    }

    if dropped_older {
        output.push_str("\n…（日志总量超过单份报告上限，更早的历史文件未包含）\n");
    }

    Ok(output)
}

/// 导出目录：优先用户能找到的位置，移动端回退到应用数据目录
fn export_dir(app: &tauri::AppHandle) -> PathBuf {
    let path = app.path();

    #[cfg(not(mobile))]
    let candidates = [
        path.download_dir().ok(),
        path.desktop_dir().ok(),
        path.document_dir().ok(),
        path.app_data_dir().ok(),
    ];
    #[cfg(mobile)]
    let candidates = [path.download_dir().ok(), path.app_data_dir().ok()];

    candidates
        .into_iter()
        .flatten()
        .next()
        .unwrap_or_else(std::env::temp_dir)
}

/// 只保留文件名本身，避免传入的字符串携带路径分隔符（同时保留中文）
fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || matches!(c, '-' | '_' | '.') { c } else { '_' })
        .collect();
    let trimmed = cleaned.trim_matches('.').to_string();

    if trimmed.is_empty() {
        "igolib-diag.txt".to_string()
    } else {
        trimmed
    }
}

/// 目标文件已存在时追加序号，避免覆盖上一次导出的报告
fn unique_path(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("igolib-diag");
    let extension = Path::new(file_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("txt");

    for index in 1..1000 {
        let next = dir.join(format!("{}-{}.{}", stem, index, extension));
        if !next.exists() {
            return next;
        }
    }

    let fallback = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    dir.join(format!("{}-{}.{}", stem, fallback, extension))
}

#[tauri::command]
fn diag_info(app: tauri::AppHandle) -> Result<DiagInfo, String> {
    let dir = log_dir(&app)?;
    let log_files = collect_log_files(&dir)
        .into_iter()
        .map(|path| {
            let metadata = fs::metadata(&path).ok();
            LogFileInfo {
                name: path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(LOG_EXTENSION)
                    .to_string(),
                size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
                modified_ms: metadata
                    .and_then(|m| m.modified().ok())
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64),
            }
        })
        .collect();

    let package = app.package_info();

    Ok(DiagInfo {
        app_version: package.version.to_string(),
        app_name: package.name.clone(),
        identifier: app.config().identifier.clone(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        family: std::env::consts::FAMILY.to_string(),
        tauri_version: tauri::VERSION.to_string(),
        log_dir: dir.to_string_lossy().into_owned(),
        log_files,
    })
}

#[tauri::command]
fn diag_read_logs(app: tauri::AppHandle) -> Result<String, String> {
    read_all_logs(&app)
}

/// 把前端拼好的环境信息 + 磁盘上的日志合并导出为单个文本文件，返回落盘路径。
/// 参数刻意用单词名，避免前端调用的驼峰/下划线转换问题。
#[tauri::command]
fn diag_export(app: tauri::AppHandle, name: String, header: String) -> Result<String, String> {
    let logs = read_all_logs(&app)?;
    let content = format!("{}\n\n===== 应用日志 =====\n{}", header, logs);

    let dir = export_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建导出目录 {}: {}", dir.display(), e))?;

    let target = unique_path(&dir, &sanitize_file_name(&name));
    fs::write(&target, content).map_err(|e| format!("写入诊断报告失败: {}", e))?;

    log::info!("[diag] 诊断报告已导出: {}", target.display());
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
fn diag_open_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = log_dir(&app)?;
    app.opener()
        .open_path(dir.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| format!("无法打开日志目录: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    
    // 仅桌面端加载 process 插件（relaunch/exit 功能）
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![
            exchange_cookie,
            diag_info,
            diag_read_logs,
            diag_export,
            diag_open_dir
        ])
        .setup(|app| {
            // Debug 版：release 构建同样把日志落盘，用户遇到问题可直接导出，不再只能发截图
            let mut targets = Vec::new();
            // 开发时同时打到终端，方便实时观察。
            // Stdout 只有桌面端存在，且 release 下不写 stdout，避免 Windows 弹出控制台
            #[cfg(all(desktop, debug_assertions))]
            targets.push(Target::new(TargetKind::Stdout));
            targets.push(Target::new(TargetKind::LogDir { file_name: Some(LOG_FILE_NAME.into()) }));

            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Debug)
                    .level_for("webview", log::LevelFilter::Debug)
                    // 三方依赖的 debug 级日志噪音过大，压到 warn 只保留异常
                    .level_for("hyper", log::LevelFilter::Warn)
                    .level_for("reqwest", log::LevelFilter::Warn)
                    .level_for("tungstenite", log::LevelFilter::Warn)
                    .level_for("rustls", log::LevelFilter::Warn)
                    .level_for("wry", log::LevelFilter::Warn)
                    .level_for("tao", log::LevelFilter::Warn)
                    .max_file_size(LOG_MAX_FILE_SIZE)
                    .rotation_strategy(RotationStrategy::KeepSome(LOG_KEEP_FILES))
                    .timezone_strategy(TimezoneStrategy::UseLocal)
                    .file_open_strategy(FileOpenStrategy::Append)
                    .targets(targets)
                    .build(),
            )?;

            // HTTP 插件
            app.handle().plugin(tauri_plugin_http::init())?;
            // Opener 插件
            app.handle().plugin(tauri_plugin_opener::init())?;
            // 剪贴板插件
            app.handle().plugin(tauri_plugin_clipboard_manager::init())?;
            // WebSocket 插件（明日预约排队通道，桌面与 Android 均需注册）
            app.handle().plugin(tauri_plugin_websocket::init())?;

            // 仅桌面端加载以下插件
            #[cfg(not(mobile))]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
