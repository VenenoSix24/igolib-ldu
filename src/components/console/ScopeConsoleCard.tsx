import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { getLogs, subscribeLogs, type LogEntry, type LogLevel } from "@/lib/logger";

const LEVEL_TAG: Record<LogLevel, { text: string; cls: string }> = {
  debug: { text: "DEBUG", cls: "bg-slate-500/10 text-slate-500 dark:text-slate-300" },
  info: { text: "INFO", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  warn: { text: "警告", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  error: { text: "错误", cls: "bg-red-500/15 text-red-600 dark:text-red-300" },
};

function formatTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 按日志 scope 过滤的任务控制台卡：实时滚动展示该任务的运行日志。
 * 捡漏 / 续约等长循环任务共用。
 */
export function ScopeConsoleCard({
  scope,
  title,
  statusText,
  running = false,
  className,
}: {
  scope: string;
  title: string;
  statusText?: string;
  running?: boolean;
  className?: string;
}) {
  const [entries, setEntries] = useState<LogEntry[]>(() => [...getLogs()].filter((e) => e.scope === scope).slice(-100));

  useEffect(() => {
    // scope 在一次挂载内不变，历史日志走 useState 惰性初始化，这里仅订阅增量
    return subscribeLogs((entry) => {
      if (entry.scope !== scope) return;
      setEntries((prev) => [...prev, entry].slice(-100));
    });
  }, [scope]);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [entries.length]);

  const latest = useMemo(() => entries[entries.length - 1], [entries]);

  return (
    <GlassCard className={cn("p-4 md:p-5", className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          running ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-500/10 text-slate-500 dark:text-slate-300"
        )}>
          <Terminal className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-bold">{title}</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
          running ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-slate-500/10 text-slate-500 dark:text-slate-300"
        )}>
          {statusText ?? (running ? "运行中" : "待命")}
        </span>
        <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-300">{entries.length} 条</span>
      </div>

      <div
        ref={listRef}
        className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] leading-relaxed dark:border-white/[0.08] dark:bg-black/20"
      >
        {entries.length === 0 ? (
          <p className="py-3 text-center font-sans text-[11px] text-slate-400 dark:text-slate-300">
            暂无日志，任务运行后实时显示在这里
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-1.5">
              <span className="shrink-0 text-slate-400 dark:text-slate-300">{formatTime(entry.time)}</span>
              <span className={cn("shrink-0 rounded px-1 text-[9.5px] font-bold leading-5", LEVEL_TAG[entry.level].cls)}>
                {LEVEL_TAG[entry.level].text}
              </span>
              <span className={cn(
                "min-w-0 flex-1 break-words",
                entry.level === "error" ? "text-red-600 dark:text-red-300" :
                  entry.level === "warn" ? "text-amber-700 dark:text-amber-300" :
                    "text-slate-700 dark:text-slate-200"
              )}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      {latest && (
        <p className="mt-2 truncate text-[10.5px] text-slate-400 dark:text-slate-300">最近：{latest.message}</p>
      )}
    </GlassCard>
  );
}
