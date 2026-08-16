import { create } from "zustand";

/**
 * Cookie 运行时状态（不持久化）：
 * 首页校验与到期检测负责写入，其余页面据此拦截网络请求，
 * 避免 Cookie 失效后切页反复请求触发服务端风控。
 */
export type CookieStatus = "none" | "unknown" | "valid" | "invalid" | "expired";

interface AuthState {
  cookieStatus: CookieStatus;
  setCookieStatus: (status: CookieStatus) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  cookieStatus: "none",
  setCookieStatus: (cookieStatus) => set({ cookieStatus }),
}));

/** 失效（无效 / 已过期 / 无 Cookie）时应当停止一切预约相关请求 */
export function cookieBlocked(status: CookieStatus): boolean {
  return status === "invalid" || status === "expired" || status === "none";
}
