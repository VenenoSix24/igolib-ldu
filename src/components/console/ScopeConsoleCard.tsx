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
  stages,
  subtitle,
  className,
}: {
  scope: string;
  title: string;
  statusText?: string;
  running?: boolean;
  /** 本地化刻度尺：捡漏=按场馆轮询分段，续约=按循环阶段分段 */
  stages?: { labels: string[]; current: number };
  /** 状态头副标（与预约控制台同构） */
  subtitle?: string;
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
      <div className="flex items-center gap-3">
        <span className={cn("grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]", running ? "ti-emerald" : "ti-slate")}>
          <Terminal className={cn("h-5 w-5", running && "animate-pulse")} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-extrabold">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-mut">{subtitle}</p>}
        </div>
        <span className={running ? "pill ok h-[22px] px-2 text-[10px]" : "pill slate h-[22px] px-2 text-[10px]"}>
          <Terminal className={cn("h-3 w-3", running && "animate-pulse")} />
          {statusText ?? (running ? "运行中" : "待命中")}
        </span>
        <span className="mono ml-auto hidden text-[10px] text-sub sm:block">{entries.length} 条</span>
      </div>

      {stages && stages.labels.length > 0 && (
        <div className="ruler mb-3.5">
          {stages.labels.map((label, i) => (
            <div key={label} className={cn("stage", stages.current > i && "done", stages.current === i && "cur")}>
              <span className="sdot" />
              <span className="slabel">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div ref={listRef} className="logbox max-h-56 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="py-3 text-center font-sans text-[11px] text-[#94a3b8]">
            暂无日志，任务运行后实时显示在这里
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="logrow flex items-start gap-1.5">
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
