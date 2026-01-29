



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    
    // 仅桌面端加载 process 插件（relaunch/exit 功能）
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_process::init());

    builder
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
