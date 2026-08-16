import { useEffect, useState } from "react";
import { getLogs, subscribeLogs, type LogEntry } from "@/lib/logger";
import { cn } from "@/lib/utils";

const LEVEL_CLS: Record<string, string> = {
  debug: "bg-slate-400/10 text-slate-500 dark:text-slate-400",
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  error: "bg-red-500/15 text-red-600 dark:text-red-300",
};

/** 服务层运行日志的内嵌查看器（logger 环形缓冲的订阅端） */
export function LogsPanel() {
  const [entries, setEntries] = useState<LogEntry[]>(() => [...getLogs()]);

  useEffect(() => subscribeLogs(() => setEntries([...getLogs()])), []);

  const visible = entries.slice(-80).reverse();

  return (
    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-100/60 p-2 dark:border-white/[0.08] dark:bg-[#0a0c11]/60">
      {visible.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-slate-500">暂无日志</p>
      ) : (
        <div className="flex flex-col gap-1">
          {visible.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 font-mono text-[10.5px]">
              <span className="shrink-0 pt-px text-slate-400 dark:text-slate-600 dark:text-slate-500">
                {new Date(entry.time).toLocaleTimeString("zh-CN", { hour12: false })}
              </span>
              <span className={cn("shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase", LEVEL_CLS[entry.level])}>
                {entry.level}
              </span>
              <span className="min-w-0 flex-1 break-words text-slate-600 dark:text-slate-300">
                [{entry.scope}] {entry.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
