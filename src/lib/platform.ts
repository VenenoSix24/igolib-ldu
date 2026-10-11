/**
 * 运行平台判断。
 *
 * Windows 的 WebView2 是 Chromium 渲染路径，与 macOS/iOS 的 WKWebView 行为不同，
 * 个别渲染问题（如弹窗遮罩的合成闪烁）只在 Windows 出现，需要按平台做规避。
 * 在 index.html 的内联脚本里会把 `platform-windows` 类挂到 <html> 上，
 * 供 CSS 使用；这里提供同一份判断给 TS 逻辑使用。
 */
export const IS_WINDOWS =
  typeof navigator !== "undefined" && /Windows NT/.test(navigator.userAgent);
