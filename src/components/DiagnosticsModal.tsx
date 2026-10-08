import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FolderOpen,
  Info,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  clearLogs,
  formatLogTime,
  getLogs,
  subscribeLogs,
  type LogEntry,
  type LogLevel,
} from "@/lib/logger";
import {
  buildReportHeader,
  buildSessionReport,
  exportDiagnosticReport,
  fetchDiagInfo,
  formatBytes,
  openLogDirectory,
  readLogFile,
  totalLogSize,
  type DiagInfo,
  type ReportContext,
} from "@/lib/diagnostics";

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 由 Dashboard 提供的当前配置信息，仅用于报告头部，不含凭据 */
  context: ReportContext;
}

type Source = "session" | "disk";

/** 面板最多渲染的行数，避免日志一多就把 DOM 拖垮 */
const MAX_ROWS = 2000;
/** 日志写入很频繁，UI 做节流批量刷新 */
const REFRESH_INTERVAL = 200;

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: "调试",
  info: "信息",
  warn: "警告",
  error: "错误",
};

const LEVEL_ORDER: LogLevel[] = ["debug", "info", "warn", "error"];

const LEVEL_ROW_CLASS: Record<LogLevel, string> = {
  debug: "text-slate-400 dark:text-neutral-500",
  info: "text-neutral-700 dark:text-slate-300",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

const LEVEL_BADGE_CLASS: Record<LogLevel, string> = {
  debug: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400",
  info: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  warn: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

/** 从磁盘日志的一行里解析出级别，便于和会话日志一样做过滤 */
function parseDiskLineLevel(line: string): LogLevel | null {
  const match = line.match(/\[(ERROR|WARN|INFO|DEBUG|TRACE)\]/);
  if (!match) return null;
  const map: Record<string, LogLevel> = { ERROR: "error", WARN: "warn", INFO: "info", DEBUG: "debug", TRACE: "debug" };
  return map[match[1]] ?? null;
}

export function DiagnosticsModal({ isOpen, onClose, context }: DiagnosticsModalProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [info, setInfo] = useState<DiagInfo | null>(null);
  const [source, setSource] = useState<Source>("session");
  const [diskText, setDiskText] = useState<string | null>(null);
  const [activeLevels, setActiveLevels] = useState<LogLevel[]>(LEVEL_ORDER);
  const [keyword, setKeyword] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 打开面板时同步一次环境信息与当前日志
  useEffect(() => {
    if (!isOpen) return;
    setNotice(null);
    setEntries([...getLogs()]);
    void fetchDiagInfo().then(setInfo);
  }, [isOpen]);

  // 订阅日志，节流刷新
  useEffect(() => {
    if (!isOpen) return;

    let pending: number | null = null;
    const unsubscribe = subscribeLogs((event) => {
      if (event.type === "clear") {
        setEntries([]);
        return;
      }
      if (pending !== null) return;
      pending = window.setTimeout(() => {
        pending = null;
        setEntries([...getLogs()]);
      }, REFRESH_INTERVAL);
    });

    return () => {
      unsubscribe();
      if (pending !== null) window.clearTimeout(pending);
    };
  }, [isOpen]);

  const loadDiskLogs = useCallback(async () => {
    setBusy("disk");
    try {
      const text = await readLogFile();
      setDiskText(text);
    } finally {
      setBusy(null);
    }
  }, []);

  // 切到磁盘视图时按需加载
  useEffect(() => {
    if (isOpen && source === "disk" && diskText === null) {
      void loadDiskLogs();
    }
  }, [isOpen, source, diskText, loadDiskLogs]);

  const diskLines = useMemo(() => {
    if (diskText === null) return null;
    return diskText.split("\n").filter((line) => line.length > 0);
  }, [diskText]);

  const visibleEntries = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return entries
      .filter((entry) => activeLevels.includes(entry.level))
      .filter((entry) => {
        if (!needle) return true;
        return entry.message.toLowerCase().includes(needle) || entry.scope.toLowerCase().includes(needle);
      })
      .slice(-MAX_ROWS);
  }, [entries, activeLevels, keyword]);

  const visibleLines = useMemo(() => {
    if (diskLines === null) return null;
    const needle = keyword.trim().toLowerCase();
    return diskLines
      .filter((line) => {
        const level = parseDiskLineLevel(line);
        // 无法解析级别的行（如分隔标题）默认保留
        return level === null || activeLevels.includes(level);
      })
      .filter((line) => !needle || line.toLowerCase().includes(needle))
      .slice(-MAX_ROWS);
  }, [diskLines, activeLevels, keyword]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [visibleEntries.length, visibleLines?.length, autoScroll]);

  const toggleLevel = (level: LogLevel) => {
    setActiveLevels((prev) =>
      prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level]
    );
  };

  const flash = (kind: "ok" | "error", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 6000);
  };

  const reportText = useMemo(() => {
    if (source === "disk") {
      return `${buildReportHeader(info, context)}\n\n===== 应用日志（磁盘完整） =====\n${diskText ?? ""}\n`;
    }
    return buildSessionReport(info, context);
  }, [source, info, context, diskText]);

  const handleCopy = async () => {
    setBusy("copy");
    try {
      await writeText(reportText);
      flash("ok", `已复制 ${formatBytes(reportText.length)} 文本到剪贴板`);
    } catch (error) {
      flash("error", `复制失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    setBusy("export");
    try {
      const path = await exportDiagnosticReport(context);
      flash("ok", `已导出到 ${path}`);
    } catch (error) {
      flash("error", `导出失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleOpenDir = async () => {
    setBusy("open");
    const ok = await openLogDirectory();
    setBusy(null);
    if (!ok) flash("error", "打开日志目录失败，可在下方路径手动查看");
  };

  const handleClear = () => {
    // 只清当前会话的显示，磁盘上的历史日志保留，便于回看
    clearLogs();
    flash("ok", "已清空本次会话显示（磁盘日志保留）");
  };

  const cookieState = context.cookieState;
  const logSize = totalLogSize(info);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            style={{ x: "-50%", y: "-50%" }}
            className="fixed left-1/2 top-1/2 w-[94%] max-w-3xl h-[84vh] flex flex-col bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl z-50 overflow-hidden border border-slate-200 dark:border-neutral-800"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-neutral-800 shrink-0">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-500" />
                诊断日志
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* 环境信息 */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/60 shrink-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  版本 <span className="font-mono text-neutral-700 dark:text-slate-200">{info?.app_version ?? "读取中"}</span>
                </span>
                <span>
                  系统 <span className="font-mono text-neutral-700 dark:text-slate-200">{info ? `${info.os} ${info.arch}` : "-"}</span>
                </span>
                <span>
                  Tauri <span className="font-mono text-neutral-700 dark:text-slate-200">{info?.tauri_version ?? "-"}</span>
                </span>
                {context.apiPreset && (
                  <span>
                    API <span className="font-mono text-neutral-700 dark:text-slate-200">{context.apiPreset}</span>
                  </span>
                )}
                {cookieState && (
                  <span>
                    Cookie <span className="font-mono text-neutral-700 dark:text-slate-200">{cookieState}</span>
                  </span>
                )}
                <span>
                  日志 <span className="font-mono text-neutral-700 dark:text-slate-200">{formatBytes(logSize)}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400 dark:text-neutral-500">
                Cookie / token 等凭据已自动脱敏，日志仅保存在本机，不会自动上传。
              </p>
              {info?.log_dir && (
                <p className="mt-0.5 text-[11px] font-mono break-all text-slate-400 dark:text-neutral-600">{info.log_dir}</p>
              )}
            </div>

            {/* 工具条 */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-neutral-800 flex flex-wrap items-center gap-2 shrink-0">
              {/* 数据源切换 */}
              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-neutral-800 rounded-lg">
                {([["session", "本次会话"], ["disk", "磁盘完整"]] as [Source, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSource(key)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all",
                      source === key
                        ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 级别过滤 */}
              <div className="flex gap-1">
                {LEVEL_ORDER.map((level) => (
                  <button
                    key={level}
                    onClick={() => toggleLevel(level)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-bold border transition-all",
                      activeLevels.includes(level)
                        ? "border-transparent " + LEVEL_BADGE_CLASS[level]
                        : "border-slate-200 dark:border-neutral-700 text-slate-300 dark:text-neutral-600"
                    )}
                  >
                    {LEVEL_LABEL[level]}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索关键字"
                  className="h-8 pl-8 text-xs dark:border-neutral-700"
                />
              </div>

              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(event) => setAutoScroll(event.target.checked)}
                  className="accent-blue-500"
                />
                自动滚动
              </label>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadDiskLogs()}
                disabled={busy === "disk"}
                className="h-8 px-2 text-[11px] text-slate-500"
                title="重新读取磁盘日志"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", busy === "disk" && "animate-spin")} />
              </Button>
            </div>

            {/* 操作结果提示 */}
            <AnimatePresence>
              {notice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "px-4 py-2 text-[11px] font-bold border-b shrink-0 break-all",
                    notice.kind === "ok"
                      ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30"
                      : "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"
                  )}
                >
                  <span className="inline-flex items-start gap-1.5">
                    {notice.kind === "ok" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                    )}
                    {notice.text}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 日志正文 */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[rgb(16,16,16)] custom-scrollbar"
            >
              {source === "session" ? (
                visibleEntries.length === 0 ? (
                  <EmptyState text="本次会话暂无匹配日志" />
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-neutral-900">
                    {visibleEntries.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 px-3 py-1.5 font-mono text-[11px] leading-relaxed">
                        <span className="shrink-0 text-slate-400 dark:text-neutral-600 tabular-nums">
                          {formatLogTime(entry.time)}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 px-1.5 rounded text-[10px] font-bold uppercase",
                            LEVEL_BADGE_CLASS[entry.level]
                          )}
                        >
                          {entry.level}
                        </span>
                        <span className="shrink-0 text-slate-400 dark:text-neutral-600">[{entry.scope}]</span>
                        <span className={cn("break-all", LEVEL_ROW_CLASS[entry.level])}>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : visibleLines === null ? (
                <EmptyState text={busy === "disk" ? "正在读取磁盘日志…" : "尚未载入磁盘日志"} />
              ) : visibleLines.length === 0 ? (
                <EmptyState text="磁盘日志暂无匹配内容" />
              ) : (
                <div className="px-3 py-2 font-mono text-[11px] leading-relaxed">
                  {visibleLines.map((line, index) => {
                    const level = parseDiskLineLevel(line);
                    return (
                      <div key={index} className={cn("break-all", level ? LEVEL_ROW_CLASS[level] : "text-slate-400 dark:text-neutral-600 font-bold mt-2")}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* 底部动作 */}
            <div className="flex flex-wrap items-center gap-2 p-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/60 shrink-0">
              <Button size="sm" onClick={() => void handleCopy()} disabled={busy !== null} className="min-w-[112px]">
                <Copy className="w-4 h-4 mr-1.5" />
                {busy === "copy" ? "复制中…" : "复制报告"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleExport()}
                disabled={busy !== null}
                className="min-w-[112px] dark:border-neutral-700"
              >
                <Download className="w-4 h-4 mr-1.5" />
                {busy === "export" ? "导出中…" : "导出文件"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleOpenDir()}
                disabled={busy !== null}
                className="text-slate-500"
              >
                <FolderOpen className="w-4 h-4 mr-1.5" />
                打开日志目录
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClear}
                className="ml-auto text-slate-400 hover:text-red-500"
                title="仅清空当前会话显示，磁盘日志保留"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                清空显示
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 opacity-40 py-16">
      <Info className="w-8 h-8 text-slate-400" />
      <p className="text-xs font-medium text-slate-400 dark:text-neutral-600">{text}</p>
    </div>
  );
}
