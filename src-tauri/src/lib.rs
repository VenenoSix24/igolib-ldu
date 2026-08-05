use reqwest::redirect::Policy;
use std::time::Duration;
use std::collections::HashSet;

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

    for full_cookie in response.headers().get_all("set-cookie").iter().filter_map(|v| v.to_str().ok()) {
        let kv = full_cookie.split(';').next().unwrap_or("").trim().to_string();
        if !kv.is_empty() && (!kv.starts_with("SERVERID=") || !cookies_set.iter().any(|c: &String| c.starts_with("SERVERID="))) {
            let key = kv.split('=').next().unwrap_or("").to_string();
            cookies_set.retain(|c| !c.starts_with(&key));
            cookies_set.insert(kv);
        }
    }

    if cookies_set.is_empty() {
        return Err("服务器未返回 Cookie，请检查链接是否已过期。".to_string());
    }

    let mut cookie_list: Vec<String> = cookies_set.into_iter().collect();
    cookie_list.sort();
    
    Ok(cookie_list.join("; "))
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
