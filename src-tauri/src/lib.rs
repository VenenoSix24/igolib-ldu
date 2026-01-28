use tauri::Manager;

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) {
    #[cfg(not(mobile))]
    {
        if let Some(splash_window) = app.get_webview_window("splashscreen") {
            splash_window.close().unwrap();
        }

        if let Some(main_window) = app.get_webview_window("main") {
            main_window.show().unwrap();
            main_window.set_focus().unwrap();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![close_splashscreen])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            app.handle().plugin(tauri_plugin_http::init())?;
            app.handle().plugin(tauri_plugin_websocket::init())?;
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
