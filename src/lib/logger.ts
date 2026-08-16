export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  /** 毫秒时间戳 */
  time: number;
  level: LogLevel;
  scope: string;
  message: string;
  /** 附加参数（对象/错误等），仅保留引用供日志页展示 */
  detail?: unknown[];
}

const MAX_ENTRIES = 500;

const buffer: LogEntry[] = [];
const listeners = new Set<(entry: LogEntry) => void>();
let seq = 0;

function write(level: LogLevel, scope: string, message: string, detail?: unknown[]) {
  const entry: LogEntry = { id: ++seq, time: Date.now(), level, scope, message, detail };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  console[level](`[${scope}] ${message}`, ...(detail ?? []));
  listeners.forEach((fn) => fn(entry));
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, ...detail: unknown[]) => write("debug", scope, message, detail),
    info: (message: string, ...detail: unknown[]) => write("info", scope, message, detail),
    warn: (message: string, ...detail: unknown[]) => write("warn", scope, message, detail),
    error: (message: string, ...detail: unknown[]) => write("error", scope, message, detail),
  };
}

export function getLogs(): readonly LogEntry[] {
  return buffer;
}

export function clearLogs() {
  buffer.length = 0;
}

export function subscribeLogs(fn: (entry: LogEntry) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
