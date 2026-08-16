/**
 * Cookie 中 Authorization JWT 的本地解析（不发起请求）。
 * traceint 系 JWT payload 带 expireAt（Unix 秒），用于到期提醒与剩余时长展示。
 */

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

/** 从 Cookie 串提取 Authorization 的值（无则 null） */
export function extractAuthToken(cookieStr: string): string | null {
  const match = cookieStr.match(/(?:^|;\s*)Authorization=([^;]+)/);
  return match?.[1] ?? null;
}

/**
 * 解析 Cookie 的到期时间。
 * @returns Unix 毫秒时间戳；无 Authorization、解析失败或字段缺失时返回 null
 */
export function getCookieExpiry(cookieStr: string): number | null {
  const token = extractAuthToken(cookieStr);
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    const raw = typeof payload.expireAt === "number" ? payload.expireAt : Number(payload.expireAt);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    // 秒级时间戳（10 位）转毫秒，毫秒级（13 位）原样使用
    return raw < 1e12 ? raw * 1000 : raw;
  } catch {
    return null;
  }
}

/** 到期时间戳的剩余毫秒数（可为负） */
export function remainingMs(expiry: number): number {
  return expiry - Date.now();
}

/** 剩余时长的人类可读短文案 */
export function formatRemaining(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} 天 ${hours % 24} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes % 60} 分`;
  return `${minutes} 分`;
}
