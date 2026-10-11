import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { getLogs, subscribeLogs, type LogEntry, type LogLevel } from "@/lib/logger";

const LEVEL_TAG: Record<LogLevel, { text: string; cls: string }> = {
  debug: { text: "DEBUG", cls: "bg-[rgba(148,163,184,0.12)] text-[#94a3b8]" },
  info: { text: "INFO", cls: "bg-[rgba(148,163,184,0.16)] text-[#cbd5e1]" },
  warn: { text: "警告", cls: "bg-[rgba(245,158,11,0.16)] text-[#fcd34d]" },
  error: { text: "错误", cls: "bg-[rgba(244,63,94,0.16)] text-[#fda4af]" },
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
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={cn("grid h-7 w-7 place-items-center rounded-[10px]", running ? "ti-emerald" : "ti-slate")}>
          <Terminal className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-bold">{title}</span>
        <span className={running ? "pill ok h-[22px] px-2 text-[10px]" : "pill slate h-[22px] px-2 text-[10px]"}>
          {running ? <span className="ping" /> : <span className="dot" />}
          {statusText ?? (running ? "运行中" : "待命中")}
        </span>
        <span className="mono ml-auto text-[10px] text-sub">{entries.length} 条</span>
      </div>

      <div ref={listRef} className="logbox max-h-56 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="py-3 text-center font-sans text-[11px] text-[#94a3b8]">
            暂无日志，任务运行后实时显示在这里
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-1.5">
              <span className="shrink-0 text-[#64748b]">{formatTime(entry.time)}</span>
              <span className={cn("shrink-0 rounded px-1 text-[9.5px] font-bold leading-5", LEVEL_TAG[entry.level].cls)}>
                {LEVEL_TAG[entry.level].text}
              </span>
              <span className={cn(
                "min-w-0 flex-1 break-words",
                entry.level === "error" ? "text-[#fda4af]" :
                  entry.level === "warn" ? "text-[#fcd34d]" :
                    "text-[var(--log-ink)]",
              )}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      {latest && (
        <p className="mt-2 truncate text-[10.5px] text-sub">最近：{latest.message}</p>
      )}
    </GlassCard>
  );
}
