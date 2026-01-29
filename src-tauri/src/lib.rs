#[cfg(not(mobile))]
use tauri::Manager;

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) {
    // 仅在桌面端执行：关闭启动画面窗口，显示主窗口
    #[cfg(not(mobile))]
    {
        // 1. 先显示主窗口，确保应用可用
        if let Some(main_window) = app.get_webview_window("main") {
            println!("[Splash] Found main window, showing it...");
            let _ = main_window.show();
            let _ = main_window.set_focus();
        } else {
            eprintln!("[Splash] Error: Main window not found!");
        }

        // 2. 再关闭 Splash 窗口
        if let Some(splash_window) = app.get_webview_window("splashscreen") {
            println!("[Splash] Found splashscreen window, closing it...");
            if let Err(e) = splash_window.close() {
                eprintln!("[Splash] Error closing splashscreen: {:?}", e);
            } else {
                println!("[Splash] Splashscreen successfully closed.");
            }
        } else {
            eprintln!("[Splash] Error: Splashscreen window not found!");
        }
    }
    
    #[cfg(mobile)]
    {
        let _ = app;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    
    // 仅桌面端加载 process 插件（relaunch/exit 功能）
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![close_splashscreen])
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
