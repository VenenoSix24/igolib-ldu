/**
 * 诊断报告的组装与导出。
 *
 * 把「本机环境信息 + 落盘日志」拼成一份用户可以直接发出去的文本，
 * 目标是彻底替代"遇到问题只能发截图"的排障方式。
 */
import { invoke } from "@tauri-apps/api/core";
import { createLogger, getLogs, logsToText } from "./logger";

const logger = createLogger("diag");

export interface LogFileInfo {
  name: string;
  size: number;
  modified_ms: number | null;
}

export interface DiagInfo {
  app_version: string;
  app_name: string;
  identifier: string;
  os: string;
  arch: string;
  family: string;
  tauri_version: string;
  log_dir: string;
  log_files: LogFileInfo[];
}

/** 由界面层补充的、只有前端才知道的诊断信息 */
export interface ReportContext {
  apiPreset?: string;
  apiUrl?: string;
  /** Cookie 校验结论（只传结论，不传内容） */
  cookieState?: string;
  extra?: Record<string, string | number | boolean | undefined>;
}

/**
 * 调试版构建标识。
 *
 * 由 `vite build --mode debug` 置位（见 package.json 的 debug:frontend:build
 * 与 src-tauri/tauri.debug.conf.json），用于区分正式版与诊断版。
 */
export const IS_DEBUG_BUILD = import.meta.env.MODE === "debug";

/**
 * 构建戳：CI 注入的「版本-run号-commit-时间」，用于把用户发来的日志对上具体构建。
 * 本地构建时没有这个变量，显示为「本地构建」。
 */
export const BUILD_STAMP = String(import.meta.env.VITE_BUILD_STAMP ?? "").trim() || "本地构建";

export async function fetchDiagInfo(): Promise<DiagInfo | null> {
  try {
    return await invoke<DiagInfo>("diag_info");
  } catch (error) {
    logger.warn("读取诊断环境信息失败", error);
    return null;
  }
}

/** 读取磁盘上的全部日志（新→旧，Rust 侧已做体积上限保护） */
export async function readLogFile(): Promise<string> {
  try {
    return await invoke<string>("diag_read_logs");
  } catch (error) {
    logger.warn("读取日志文件失败", error);
    return "";
  }
}

export async function openLogDirectory(): Promise<boolean> {
  try {
    await invoke("diag_open_dir");
    return true;
  } catch (error) {
    logger.warn("打开日志目录失败", error);
    return false;
  }
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function totalLogSize(info: DiagInfo | null): number {
  return (info?.log_files ?? []).reduce((sum, file) => sum + (file.size || 0), 0);
}

export function buildReportHeader(info: DiagInfo | null, context: ReportContext): string {
  const lines: string[] = ["===== 我去抢个座 · 诊断报告 ====="];

  lines.push(`导出时间: ${new Date().toLocaleString()}`);
  lines.push(`构建: ${BUILD_STAMP}`);
  if (info) {
    lines.push(`应用: ${info.app_name} v${info.app_version}${IS_DEBUG_BUILD ? "（诊断版）" : ""}`);
    lines.push(`应用标识: ${info.identifier}`);
    lines.push(`系统: ${info.os} ${info.arch} (${info.family})`);
    lines.push(`Tauri: ${info.tauri_version}`);
    lines.push(`日志目录: ${info.log_dir}`);
  }
  if (context.apiPreset) lines.push(`API 预设: ${context.apiPreset}`);
  if (context.apiUrl) lines.push(`API 地址: ${context.apiUrl}`);
  if (context.cookieState) lines.push(`Cookie 状态: ${context.cookieState}`);
  if (typeof navigator !== "undefined") lines.push(`运行环境: ${navigator.userAgent}`);

  for (const [key, value] of Object.entries(context.extra ?? {})) {
    if (value !== undefined) lines.push(`${key}: ${value}`);
  }

  lines.push("");
  lines.push("说明: Cookie / token 等凭据已自动脱敏；本报告仅保存在本机，不会自动上传。");
  return lines.join("\n");
}

/** 当前会话的日志（内存缓冲），体积小，适合直接粘贴到聊天窗口 */
export function buildSessionReport(info: DiagInfo | null, context: ReportContext): string {
  return `${buildReportHeader(info, context)}\n\n===== 本次会话日志 =====\n${logsToText(getLogs())}\n`;
}

function timestampForFileName(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** 导出完整报告文件（含 Rust 侧日志与轮转的历史文件），返回落盘路径 */
export async function exportDiagnosticReport(context: ReportContext): Promise<string> {
  const info = await fetchDiagInfo();
  const header = buildReportHeader(info, context);

  const path = await invoke<string>("diag_export", {
    name: `igolib-diag-${timestampForFileName()}.txt`,
    header,
  });

  logger.info("诊断报告已导出", { path });
  return path;
}
