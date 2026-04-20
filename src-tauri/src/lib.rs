use reqwest::redirect::Policy;
use std::time::Duration;

/// 从微信回调链接中获取 Cookie
#[tauri::command]
async fn exchange_cookie(auth_url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;

    let response = client
        .get(&auth_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090719) XWEB/8391 Flue")
        .header("Accept", "*/*")
        .send()
        .await
        .map_err(|e| format!("请求发送失败: {}", e))?;

    // 提取所有 Set-Cookie 头
    let cookies: Vec<String> = response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .map(|full| {
            // 只取 key=value 部分，忽略 Path, HttpOnly 等属性
            full.split(';').next().unwrap_or("").trim().to_string()
        })
        .filter(|s| !s.is_empty())
        .collect();

    if cookies.is_empty() {
        return Err("服务器未返回 Cookie，请检查链接是否已过期。".to_string());
    }

    let cookie_string = cookies.join("; ");
    Ok(cookie_string)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    
    // 仅桌面端加载 process 插件（relaunch/exit 功能）
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![exchange_cookie])
        .setup(|app| {
            // Debug 模式下启用日志
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // HTTP 插件
            app.handle().plugin(tauri_plugin_http::init())?;
            // Opener 插件
            app.handle().plugin(tauri_plugin_opener::init())?;
            // 剪贴板插件
            app.handle().plugin(tauri_plugin_clipboard_manager::init())?;
            
            // 仅桌面端加载以下插件
            #[cfg(not(mobile))]
            {
                app.handle().plugin(tauri_plugin_websocket::init())?;
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
