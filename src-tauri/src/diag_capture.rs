//! 抓取应用窗口当前画面，用于捕获转瞬即逝的渲染问题（如 Windows 上的弹窗闪烁）。
//!
//! 仅 Windows 实现：从屏幕 DC 对应用窗口区域做 BitBlt（拿到的是 DWM 合成后
//! 实际显示的内容），编码为 PNG 存到日志目录的 captures/ 子目录。
//! 非 Windows 平台返回错误占位，命令保持注册以便前端统一调用。

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// 把当前应用窗口的画面存成 PNG，返回落盘路径
#[tauri::command]
pub fn diag_capture_screen(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<String, String> {
    // 注意：cfg 切换的两个块不能用尾表达式（会被当成语句丢掉返回值），必须显式 return
    #[cfg(windows)]
    {
        let png = capture_window_png(&window)?;
        return save_capture(&app, &png);
    }
    #[cfg(not(windows))]
    {
        let _ = (&app, &window);
        Err("屏幕捕获仅在 Windows 上可用".to_string())
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
fn save_capture(app: &tauri::AppHandle, png: &[u8]) -> Result<String, String> {
    let dir: PathBuf = crate::log_dir(app)?.join("captures");
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建捕获目录: {}", e))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = dir.join(format!("capture-{}.png", now));
    std::fs::write(&path, png).map_err(|e| format!("写入捕获文件失败: {}", e))?;

    Ok(path.to_string_lossy().into_owned())
}

#[cfg(windows)]
mod win {
    // Win32 最小 FFI：只声明用到的部分，避免为此引入新的依赖

    pub const SRCCOPY: u32 = 0x00CC_0020;
    pub const DIB_RGB_COLORS: u32 = 0;

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    #[allow(non_snake_case)]
    pub struct Rect {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    pub struct BitmapInfoHeader {
        pub biSize: u32,
        pub biWidth: i32,
        pub biHeight: i32,
        pub biPlanes: u16,
        pub biBitCount: u16,
        pub biCompression: u32,
        pub biSizeImage: u32,
        pub biXPelsPerMeter: i32,
        pub biYPelsPerMeter: i32,
        pub biClrUsed: u32,
        pub biClrImportant: u32,
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    pub struct BitmapInfo {
        pub bmiHeader: BitmapInfoHeader,
        pub bmiColors: [u32; 1],
    }

    #[link(name = "user32")]
    #[allow(non_snake_case)]
    extern "system" {
        pub fn GetWindowRect(hwnd: isize, rect: *mut Rect) -> i32;
        pub fn GetDC(hwnd: isize) -> isize;
        pub fn ReleaseDC(hwnd: isize, hdc: isize) -> i32;
    }

    #[link(name = "gdi32")]
    #[allow(non_snake_case)]
    extern "system" {
        pub fn CreateCompatibleDC(hdc: isize) -> isize;
        pub fn CreateCompatibleBitmap(hdc: isize, width: i32, height: i32) -> isize;
        pub fn SelectObject(hdc: isize, obj: isize) -> isize;
        pub fn DeleteObject(obj: isize) -> i32;
        pub fn DeleteDC(hdc: isize) -> i32;
        pub fn BitBlt(
            dst: isize,
            dx: i32,
            dy: i32,
            w: i32,
            h: i32,
            src: isize,
            sx: i32,
            sy: i32,
            rop: u32,
        ) -> i32;
        pub fn GetDIBits(
            dc: isize,
            bmp: isize,
            start: u32,
            lines: u32,
            data: *mut u8,
            info: *mut BitmapInfo,
            usage: u32,
        ) -> i32;
    }
}

#[cfg(windows)]
fn capture_window_png(window: &tauri::WebviewWindow) -> Result<Vec<u8>, String> {
    use win::*;

    let hwnd = window
        .hwnd()
        .map_err(|e| format!("获取窗口句柄失败: {}", e))?
        .0 as isize;

    unsafe {
        let mut rect = Rect::default();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return Err("GetWindowRect 失败".into());
        }
        let width = (rect.right - rect.left).max(1);
        let height = (rect.bottom - rect.top).max(1);

        let screen_dc = GetDC(0);
        if screen_dc == 0 {
            return Err("GetDC 失败".into());
        }
        let mem_dc = CreateCompatibleDC(screen_dc);
        let bitmap = if mem_dc == 0 {
            ReleaseDC(0, screen_dc);
            return Err("CreateCompatibleDC 失败".into());
        } else {
            CreateCompatibleBitmap(screen_dc, width, height)
        };
        let old = if bitmap == 0 {
            DeleteDC(mem_dc);
            ReleaseDC(0, screen_dc);
            return Err("CreateCompatibleBitmap 失败".into());
        } else {
            SelectObject(mem_dc, bitmap)
        };

        let blit_ok = BitBlt(mem_dc, 0, 0, width, height, screen_dc, rect.left, rect.top, SRCCOPY);

        // GetDIBits 要求位图未被选入 DC
        SelectObject(mem_dc, old);

        let mut pixels: Vec<u8> = Vec::with_capacity((width as usize) * (height as usize) * 4);
        let mut info = BitmapInfo {
            bmiHeader: BitmapInfoHeader {
                biSize: size_of::<BitmapInfoHeader>() as u32,
                biWidth: width,
                biHeight: -height, // 负值表示自上而下
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0, // BI_RGB
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [0; 1],
        };

        let lines = if blit_ok == 0 {
            0
        } else {
            GetDIBits(
                mem_dc,
                bitmap,
                0,
                height as u32,
                pixels.as_mut_ptr(),
                &mut info,
                DIB_RGB_COLORS,
            )
        };

        // 无论成败都要清理 GDI 资源
        DeleteObject(bitmap);
        DeleteDC(mem_dc);
        ReleaseDC(0, screen_dc);

        if blit_ok == 0 {
            return Err("BitBlt 失败".into());
        }
        if lines == 0 {
            return Err("GetDIBits 失败".into());
        }
        pixels.resize((width as usize) * (height as usize) * 4, 0);

        // DC 里拿到的是 BGRA，转成 RGBA
        for px in pixels.chunks_exact_mut(4) {
            px.swap(0, 2);
        }

        let img = image::RgbaImage::from_raw(width as u32, height as u32, pixels)
            .ok_or_else(|| "像素缓冲与窗口尺寸不匹配".to_string())?;

        let mut out = std::io::Cursor::new(Vec::new());
        img.write_to(&mut out, image::ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;
        Ok(out.into_inner())
    }
}
