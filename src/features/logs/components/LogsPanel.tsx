import { useEffect, useState } from "react";
import { getLogs, subscribeLogs, type LogEntry } from "@/lib/logger";
import { cn } from "@/lib/utils";

const LEVEL_CLS: Record<string, string> = {
  debug: "bg-[rgba(148,163,184,0.12)] text-[#94a3b8]",
  info: "bg-[rgba(148,163,184,0.16)] text-[#cbd5e1]",
  warn: "bg-[rgba(245,158,11,0.16)] text-[#fcd34d]",
  error: "bg-[rgba(244,63,94,0.16)] text-[#fda4af]",
};

/** 服务层运行日志的内嵌查看器（logger 环形缓冲的订阅端） */
export function LogsPanel() {
  const [entries, setEntries] = useState<LogEntry[]>(() => [...getLogs()]);

  useEffect(() => subscribeLogs(() => setEntries([...getLogs()])), []);

  const visible = entries.slice(-80).reverse();

  return (
    <div className="logbox max-h-56 overflow-y-auto p-2.5">
      {visible.length === 0 ? (
        <p className="py-4 text-center font-sans text-[11px] text-[#94a3b8]">暂无日志</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {visible.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 rounded-md px-1.5 py-0.5">
              <span className="shrink-0 pt-px text-[10px] text-[#64748b]">
                {new Date(entry.time).toLocaleTimeString("zh-CN", { hour12: false })}
              </span>
              <span className={cn("shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase", LEVEL_CLS[entry.level])}>
                {entry.level}
              </span>
              <span className="min-w-0 flex-1 break-words text-[var(--log-ink)]">
                [{entry.scope}] {entry.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
