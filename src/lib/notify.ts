import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/** 确保通知权限已授予；浏览器环境返回 false */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** 发送系统通知；权限未授予或浏览器环境静默跳过 */
export async function notify(title: string, body?: string) {
  if (!(await ensureNotificationPermission())) return;
  try {
    sendNotification({ title, body });
  } catch {
    // 通知发送失败不影响主流程
  }
}
