import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Rocket, StopCircle, Timer, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import type { LogEntry, TaskStatus } from "../model/useBookingTask";

const STEPS = [
  { key: "waiting", label: "等待" },
  { key: "countdown", label: "倒计时" },
  { key: "queuing", label: "排队" },
  { key: "reserving", label: "预约" },
  { key: "done", label: "完成" },
] as const;

/** currentPhase（任务回调写入）到步进器下标的映射 */
function stepIndex(phase: string): number {
  switch (phase) {
    case "waiting": return 0;
    case "countdown": return 1;
    case "queuing": return 2;
    case "reserving":
    case "executing": return 3;
    case "done":
    case "failed":
    case "cancelled": return 4;
    default: return 0;
  }
}

function levelTag(log: LogEntry): { text: string; cls: string } {
  switch (log.event ?? log.type) {
    case "success": return { text: "成功", cls: "bg-green-500/15 text-green-300" };
    case "error": return { text: "错误", cls: "bg-red-400/15 text-red-300" };
    case "warning":
    case "cancelled": return { text: "警告", cls: "bg-amber-400/15 text-amber-300" };
    case "countdown": return { text: "倒计时", cls: "bg-cyan-400/15 text-cyan-300" };
    case "phase": return { text: "阶段", cls: "bg-blue-400/15 text-blue-300" };
    default: return { text: "INFO", cls: "bg-blue-400/10 text-slate-400" };
  }
}

type LogFilter = "all" | "key" | "error";

function passFilter(log: LogEntry, filter: LogFilter): boolean {
  if (filter === "all") return true;
  if (filter === "error") return log.type === "error";
  // 关键：阶段、成功、失败、取消
  return log.event === "phase" || log.event === "success" || log.type === "error" || log.type === "success";
}

const STATUS_META: Record<TaskStatus, { icon: typeof Timer; iconCls: string; chip: string; title: string }> = {
  idle: { icon: Timer, iconCls: "bg-white/10 text-slate-400", chip: "text-slate-400 bg-white/[0.06] border-white/15", title: "任务控制台" },
  connecting: { icon: Zap, iconCls: "bg-blue-400/20 text-blue-300", chip: "text-green-300 bg-green-500/10 border-green-400/30", title: "正在连接…" },
  running: { icon: Zap, iconCls: "bg-blue-400/20 text-blue-300", chip: "text-green-300 bg-green-500/10 border-green-400/30", title: "正在执行…" },
  success: { icon: Rocket, iconCls: "bg-green-500/15 text-green-300", chip: "text-green-300 bg-green-500/10 border-green-400/30", title: "预约成功 · 座位已锁定" },
  failed: { icon: StopCircle, iconCls: "bg-red-400/15 text-red-300", chip: "text-red-300 bg-red-400/10 border-red-400/30", title: "任务失败" },
  cancelled: { icon: StopCircle, iconCls: "bg-amber-400/15 text-amber-300", chip: "text-amber-300 bg-amber-400/10 border-amber-400/30", title: "任务已取消" },
};

interface ConsoleCardProps {
  status: TaskStatus;
  currentPhase: string;
  latestLog: string;
  logs: LogEntry[];
  setLogs: (logs: LogEntry[]) => void;
  countDownStr?: string | null;
  onStop: () => void;
}

/** 任务控制台：状态头 / 阶段步进器 / 日志流 / 操作行 */
export function ConsoleCard({
  status, currentPhase, latestLog, logs, setLogs, countDownStr, onStop,
}: ConsoleCardProps) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const logEndRef = useRef<HTMLDivElement>(null);
  const running = status === "running" || status === "connecting";

  const visibleLogs = useMemo(() => logs.filter((l) => passFilter(l, filter)), [logs, filter]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const current = stepIndex(currentPhase);
  const terminal = status === "success" || status === "failed" || status === "cancelled";
  const doneAll = currentPhase === "done" || status === "success";

  const subTitle =
    status === "idle"
      ? countDownStr ? `已就绪 · 距计划执行 ${countDownStr}` : "已就绪"
      : latestLog;

  return (
    <GlassCard className="flex flex-col gap-3.5 p-4 md:p-5">
      {/* 状态头 */}
      <div className="flex items-center gap-3">
        <div className={cn("flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl", meta.iconCls)}>
          <StatusIcon className={cn("h-5 w-5", running && "animate-pulse")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn(
            "text-[14.5px] font-extrabold",
            status === "success" && "text-green-300",
            status === "failed" && "text-red-300",
            status === "cancelled" && "text-amber-300",
          )}>{meta.title}</div>
          <div className="truncate font-mono text-[11.5px] text-slate-500 dark:text-slate-400">{subTitle}</div>
        </div>
        <span className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
          meta.chip,
        )}>
          <span className={cn("h-[7px] w-[7px] rounded-full bg-current", running && "animate-pulse")} />
          {running ? "运行中" : status === "idle" ? "待命" : status === "success" ? "完成" : status === "failed" ? "失败" : "已取消"}
        </span>
        <button
          type="button"
          aria-label="清空日志"
          onClick={() => setLogs([])}
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-slate-400 transition-colors hover:text-slate-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 阶段步进器 */}
      <div>
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const isDone = terminal ? true : i < current;
            const isAct = !terminal && i === current;
            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex w-14 shrink-0 flex-col items-center gap-1">
                  <div className={cn(
                    "flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[11px] transition-all",
                    isDone
                      ? "border-green-400/40 bg-green-500/15 text-green-300"
                      : isAct
                        ? "animate-pulse border-blue-400/60 bg-blue-400/20 text-blue-100 shadow-[0_0_0_4px_rgba(125,167,255,0.15)]"
                        : "border-white/15 bg-white/[0.08] text-slate-500",
                  )}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : isAct ? i + 1 : <Clock className="h-3.5 w-3.5" />}
                  </div>
                  <span className={cn(
                    "whitespace-nowrap text-[10px]",
                    isDone ? "text-green-300" : isAct ? "font-bold text-blue-300" : "text-slate-500",
                  )}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "-mt-4 h-[2.5px] min-w-2 flex-1 rounded-full",
                    doneAll || i < current ? "bg-green-400/50" : "bg-white/10",
                  )} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-right font-mono text-[10.5px] text-slate-500 tabular-nums">
          Step {Math.min(current + 1, STEPS.length)} / {STEPS.length}
          {doneAll && " · 全部完成"}
        </div>
      </div>

      {/* 日志流 */}
      <div className="flex min-h-32 flex-col gap-1.5 rounded-2xl border border-white/[0.08] bg-[#080b18]/60 p-2.5">
        {visibleLogs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-slate-500">
            <span className="text-2xl grayscale">☕</span>
            <span className="text-[11.5px]">Ready when you are</span>
          </div>
        ) : (
          visibleLogs.map((log, i) => {
            const tag = levelTag(log);
            const isLast = i === visibleLogs.length - 1;
            return (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2 py-1.5 font-mono text-[11.5px]",
                  isLast && log.event !== "success" && log.type !== "error" ? "bg-white/[0.05]" : "",
                )}
              >
                <span className="shrink-0 pt-px text-[10.5px] text-slate-600 dark:text-slate-500">{log.timestamp.split(" ")[0]}</span>
                <span className={cn("mt-px shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold", tag.cls)}>{tag.text}</span>
                <span className="min-w-0 flex-1 break-words text-slate-600 dark:text-slate-300">
                  {log.message}
                  {log.count && log.count > 1 && (
                    <span className="ml-2 shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[9.5px] text-slate-400">×{log.count}</span>
                  )}
                  {isLast && running && <span className="ml-1 inline-block h-3 w-[7px] animate-pulse rounded-sm bg-blue-300 align-[-2px]" />}
                </span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>

      {/* 操作行 */}
      {running && (
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onStop}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-300 to-red-400 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg shadow-red-400/30 transition-transform active:scale-[0.97]"
          >
            <StopCircle className="h-4 w-4" />终止任务
          </button>
          {(["all", "key", "error"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                filter === f
                  ? "border-transparent bg-white/90 font-bold text-[#131a2a]"
                  : "border-white/10 bg-white/[0.06] text-slate-400 hover:text-slate-200",
              )}
            >
              {f === "all" ? "全部" : f === "key" ? "关键" : "错误"}
            </button>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
