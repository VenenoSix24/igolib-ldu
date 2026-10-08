/**
 * 统一日志器
 *
 * 前端所有日志都从这里出去：先脱敏，再进内存环形缓冲（供「诊断日志」面板展示），
 * 同时转发给 Rust 侧的 tauri-plugin-log 落盘，最终可一键导出给作者排障。
 *
 * 导出/查看入口见 `@/components/DiagnosticsModal`。
 */
import {
  debug as nativeDebug,
  error as nativeError,
  info as nativeInfo,
  warn as nativeWarn,
} from "@tauri-apps/plugin-log";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  /** 毫秒时间戳 */
  time: number;
  level: LogLevel;
  /** 日志来源模块，便于过滤定位 */
  scope: string;
  /** 已脱敏的消息（附加参数会序列化后拼在末尾） */
  message: string;
}

export type LogEvent = { type: "entry"; entry: LogEntry } | { type: "clear" };

/** 内存中保留的日志条数上限 */
const MAX_ENTRIES = 3000;
/** 单条日志附加参数的字符数上限 */
const MAX_DETAIL_LENGTH = 2000;
/** 数值长度低于此阈值的字符串不做掩码，避免把错误码/布尔值也遮掉 */
const MASK_MIN_LENGTH = 12;

// ---------------------------------------------------------------------------
// 脱敏
// ---------------------------------------------------------------------------

/** 键名归一化（去掉大小写与分隔符差异）后命中即整体脱敏 */
const SENSITIVE_KEYS = new Set([
  "cookie",
  "setcookie",
  "authorization",
  "auth",
  "token",
  "accesstoken",
  "refreshtoken",
  "password",
  "passwd",
  "pwd",
  "secret",
  "signature",
  "ticket",
  "session",
  "sessionid",
  "sessid",
  "jsessionid",
  "serverid",
  "wechatsessid",
  "wechat",
  "openid",
  "unionid",
  "code",
]);

/**
 * 自由文本里的凭据模式。
 *
 * 前缀整体作为捕获组，保证替换后 `key = value` 的分隔符不丢失；
 * 值里排除 `&` 与引号，避免把 URL 后续参数一起吞掉。
 */
const INLINE_SECRET = new RegExp(
  `(\\b(?:${[
    "cookie",
    "authorization",
    "token",
    "password",
    "passwd",
    "pwd",
    "secret",
    "signature",
    "session",
    "sessid",
    "serverid",
    "jsessionid",
    "phpsessid",
    "wechat",
    "openid",
    "unionid",
    "ticket",
    "code",
  ].join("|")})[\\w-]*["']?\\s*[=:]\\s*["']?)([^\\s&;,)\\]}"']{4,})`,
  "gi"
);

const INLINE_BEARER = /(bearer\s+)([A-Za-z0-9\-._~+/]{8,}=*)/gi;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

/**
 * 掩码一个凭据值：保留少量前后缀和原始长度，既能确认"这里确实有 Cookie"，
 * 又不足以还原出可用凭据。
 */
function maskString(value: unknown): string {
  if (typeof value !== "string") return "[已脱敏]";
  if (value.length === 0) return "";

  // 短字符串可能是错误码一类的内容，整体遮掉即可
  if (value.length < MASK_MIN_LENGTH) return "***";

  return `${value.slice(0, 4)}…${value.slice(-2)}(已脱敏, len=${value.length})`;
}

/**
 * 掩码一个凭据字段。形如 `a=1; b=2` 的 Cookie 串只掩码各段的取值，
 * 保留 Cookie 名，这样"到底带了哪几个 Cookie"仍然可读。
 */
function maskCredential(value: unknown): string {
  if (typeof value !== "string") return "[已脱敏]";
  if (value.length === 0) return "";

  if (value.includes("=") && value.length >= MASK_MIN_LENGTH) {
    return value
      .split(/;\s*/)
      .map((pair) => {
        const separator = pair.indexOf("=");
        if (separator <= 0) return maskString(pair);
        const name = pair.slice(0, separator).trim();
        return `${name}=${maskString(pair.slice(separator + 1))}`;
      })
      .join("; ");
  }

  return maskString(value);
}

/** 对自由文本做模式化脱敏（Cookie 串、Bearer token、URL 里的 code 等） */
function sanitizeText(text: string): string {
  return text
    .replace(INLINE_BEARER, (_match, prefix: string) => `${prefix}***`)
    .replace(INLINE_SECRET, (match, prefix: string, secret: string) => {
      // `Authorization: Bearer <token>` 已由上面这条规则处理，这里不要重复掩码
      if (/^bearer$/i.test(secret.trim())) return match;
      return `${prefix}${maskString(secret)}`;
    });
}

/** 递归脱敏任意值，键名命中敏感名单时掩码取值 */
function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[层级过深]";
  if (value == null) return value;
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return `${value.name}: ${sanitizeText(value.message)}`;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
    return value.length > 50 ? [...items, `…共 ${value.length} 项`] : items;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (!isSensitiveKey(key)) {
        result[key] = sanitizeValue(item, depth + 1);
      } else if (typeof item === "string") {
        result[key] = maskCredential(item);
      } else if (item === null || typeof item === "number" || typeof item === "boolean") {
        // 错误码一类的数值不掩码，否则会给排障添堵
        result[key] = item;
      } else {
        result[key] = "[已脱敏]";
      }
    }
    return result;
  }
  return String(value);
}

function stringifyDetail(detail: unknown[]): string {
  if (detail.length === 0) return "";

  const parts = detail.map((item) => {
    const sanitized = sanitizeValue(item);
    if (typeof sanitized === "string") return sanitized;
    try {
      return JSON.stringify(sanitized);
    } catch {
      return String(sanitized);
    }
  });

  const text = parts.join(" ");
  return text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}…(已截断)` : text;
}

// ---------------------------------------------------------------------------
// 日志状态
// ---------------------------------------------------------------------------

const buffer: LogEntry[] = [];
const listeners = new Set<(event: LogEvent) => void>();
let sequence = 0;

/** 连续转发失败次数，用于在非 Tauri 环境（如浏览器里跑 vite）自动静默 */
let nativeFailureCount = 0;

function forwardToNative(level: LogLevel, line: string): void {
  if (nativeFailureCount > 5) return;

  const send = level === "error" ? nativeError : level === "warn" ? nativeWarn : level === "debug" ? nativeDebug : nativeInfo;

  send(line)
    .then(() => {
      nativeFailureCount = 0;
    })
    .catch(() => {
      nativeFailureCount += 1;
    });
}

function write(level: LogLevel, scope: string, message: string, detail: unknown[]): void {
  const safeMessage = sanitizeText(String(message));
  const detailText = stringifyDetail(detail);
  const text = detailText ? `${safeMessage} ${detailText}` : safeMessage;

  const entry: LogEntry = {
    id: ++sequence,
    time: Date.now(),
    level,
    scope,
    message: text,
  };

  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();

  // 开发时保留 WebView 控制台输出，release 下同样无害
  const consoleMethod = { debug: console.debug, info: console.info, warn: console.warn, error: console.error }[level];
  consoleMethod(`[${scope}] ${text}`);

  listeners.forEach((listener) => listener({ type: "entry", entry }));
  forwardToNative(level, `[${scope}] ${text}`);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, ...detail: unknown[]) => write("debug", scope, message, detail),
    info: (message: string, ...detail: unknown[]) => write("info", scope, message, detail),
    warn: (message: string, ...detail: unknown[]) => write("warn", scope, message, detail),
    error: (message: string, ...detail: unknown[]) => write("error", scope, message, detail),
  };
}

export type Logger = ReturnType<typeof createLogger>;

export function getLogs(): readonly LogEntry[] {
  return buffer;
}

export function clearLogs(): void {
  buffer.length = 0;
  listeners.forEach((listener) => listener({ type: "clear" }));
}

export function subscribeLogs(listener: (event: LogEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function formatLogTime(time: number): string {
  const date = new Date(time);
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/** 把日志拼成可复制的纯文本 */
export function logsToText(entries: readonly LogEntry[] = buffer): string {
  return entries
    .map((entry) => `${formatLogTime(entry.time)} ${entry.level.toUpperCase().padEnd(5)} [${entry.scope}] ${entry.message}`)
    .join("\n");
}

/**
 * 捕获未处理异常与 Promise 拒绝，避免"用户只看到界面卡住/闪退"却没有任何线索。
 * 由 App 启动时调用一次。
 */
let globalHandlersInstalled = false;

export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled || typeof window === "undefined") return;
  globalHandlersInstalled = true;

  const logger = createLogger("runtime");

  window.addEventListener("error", (event) => {
    logger.error("未捕获异常", {
      message: event.message,
      at: `${event.filename || "?"}:${event.lineno}:${event.colno}`,
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logger.error("未处理的 Promise 拒绝", event.reason);
  });
}
