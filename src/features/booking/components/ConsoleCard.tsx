import { useEffect, useMemo, useRef, useState } from "react";
import { Rocket, StopCircle, Timer, Trash2, Zap } from "lucide-react";
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

/** currentPhase（任务回调写入）到刻度尺下标的映射 */
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
    case "success": return { text: "成功", cls: "bg-[rgba(16,185,129,0.16)] text-[#6ee7b7]" };
    case "error": return { text: "错误", cls: "bg-[rgba(244,63,94,0.16)] text-[#fda4af]" };
    case "warning":
    case "cancelled": return { text: "警告", cls: "bg-[rgba(245,158,11,0.16)] text-[#fcd34d]" };
    case "countdown": return { text: "倒计时", cls: "bg-[rgba(148,163,184,0.16)] text-[var(--acc-hi)]" };
    case "phase": return { text: "阶段", cls: "bg-[rgba(148,163,184,0.16)] text-[var(--acc-hi)]" };
    default: return { text: "INFO", cls: "bg-[rgba(148,163,184,0.12)] text-[#94a3b8]" };
  }
}

type LogFilter = "all" | "key" | "error";

function passFilter(log: LogEntry, filter: LogFilter): boolean {
  if (filter === "all") return true;
  if (filter === "error") return log.type === "error";
  // 关键：阶段、成功、失败、取消
  return log.event === "phase" || log.event === "success" || log.type === "error" || log.type === "success";
}

const STATUS_META: Record<TaskStatus, { icon: typeof Timer; tile: string; pill: string; title: string; titleCls: string }> = {
  idle: { icon: Timer, tile: "ti-slate", pill: "pill slate", title: "任务控制台", titleCls: "" },
  connecting: { icon: Zap, tile: "ti-pri", pill: "pill pri", title: "正在连接…", titleCls: "" },
  running: { icon: Zap, tile: "ti-pri", pill: "pill pri", title: "正在执行…", titleCls: "" },
  success: { icon: Rocket, tile: "ti-emerald", pill: "pill ok", title: "预约成功，座位已锁定", titleCls: "text-ok-ink dark:text-[#6ee7b7]" },
  failed: { icon: StopCircle, tile: "ti-err", pill: "pill err", title: "任务失败", titleCls: "text-err-ink dark:text-[#fda4af]" },
  cancelled: { icon: StopCircle, tile: "ti-amber", pill: "pill warn", title: "任务已取消", titleCls: "text-warn-ink dark:text-[#fcd34d]" },
};

/** 空状态：CSS 绘制的迷你座位图，几个座位亮起等待任务 */
function EmptySeatsGlyph() {
  const lit = new Set([3, 8, 16, 22]);
  return (
    <div className="grid w-fit grid-cols-7 gap-1" aria-hidden="true">
      {Array.from({ length: 21 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-[3px]",
            lit.has(i) ? "animate-pulse bg-[var(--pri)]" : "bg-[rgba(100,116,139,0.2)]",
          )}
          style={lit.has(i) ? { animationDelay: `${(i % 7) * 200}ms` } : undefined}
        />
      ))}
    </div>
  );
}

interface ConsoleCardProps {
  status: TaskStatus;
  currentPhase: string;
  latestLog: string;
  logs: LogEntry[];
  setLogs: (logs: LogEntry[]) => void;
  countDownStr?: string | null;
  onStop: () => void;
}

/** 任务控制台：状态头 / 任务刻度尺 / 日志流 / 操作行 */
export function ConsoleCard({
  status, currentPhase, latestLog, logs, setLogs, countDownStr, onStop,
}: ConsoleCardProps) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const logEndRef = useRef<HTMLDivElement>(null);
  const running = status === "running" || status === "connecting";

  const visibleLogs = useMemo(() => logs.filter((l) => passFilter(l, filter)), [logs, filter]);

  // 有新日志时跟随滚动；空列表不滚动，避免页面加载被拽到底部
  useEffect(() => {
    if (logs.length > 0) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [logs]);

  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const current = stepIndex(currentPhase);
  const terminal = status === "success" || status === "failed" || status === "cancelled";
  const doneAll = currentPhase === "done" || status === "success";

  const subTitle =
    status === "idle"
      ? countDownStr ? `待命 · 距计划执行 ${countDownStr}` : "待命"
      : latestLog;

  return (
    <GlassCard className="flex flex-col gap-3.5 p-4 md:p-5">
      {/* 状态头 */}
      <div className="flex items-center gap-3">
        <span className={cn("grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]", meta.tile)}>
          <StatusIcon className={cn("h-5 w-5", running && "animate-pulse")} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn("text-[14.5px] font-extrabold", meta.titleCls)}>{meta.title}</div>
          <div className="mono hidden truncate text-[11px] text-mut sm:block">{subTitle}</div>
        </div>
        <span className={meta.pill}>
          {running ? <span className="ping" /> : <span className="dot" />}
          {running ? "运行中" : status === "idle" ? "待命中" : status === "success" ? "完成" : status === "failed" ? "失败" : "已取消"}
        </span>
        <button
          type="button"
          aria-label="清空日志"
          onClick={() => setLogs([])}
          className="btn ghost sm shrink-0 px-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 任务刻度尺 */}
      <div>
        <div className="ruler">
          {STEPS.map((step, i) => {
            const isDone = terminal ? true : i < current;
            const isAct = !terminal && i === current;
            return (
              <div key={step.key} className={cn("stage", isDone && "done", isAct && "cur")}>
                <span className="sdot" />
                <span className="slabel">{step.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mono mt-1.5 text-right text-[10.5px] tabular-nums text-sub">
          {Math.min(current + 1, STEPS.length)} / {STEPS.length}
          {doneAll && " · 全部完成"}
        </div>
      </div>

      {/* 日志流 */}
      <div className="logbox flex min-h-32 flex-col gap-1 p-3">
        {visibleLogs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-6">
            <EmptySeatsGlyph />
            <span className="text-[11.5px] text-[#94a3b8]">任务启动后，执行记录实时显示在这里</span>
          </div>
        ) : (
          visibleLogs.map((log, i) => {
            const tag = levelTag(log);
            const isLast = i === visibleLogs.length - 1;
            return (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2 py-1",
                  isLast && log.event !== "success" && log.type !== "error" ? "bg-[rgba(255,255,255,0.06)]" : "",
                )}
              >
                <span className="shrink-0 pt-px text-[10px] text-[#64748b]">{log.timestamp.split(" ")[0]}</span>
                <span className={cn("mt-px shrink-0 rounded px-1.5 text-[9.5px] font-bold", tag.cls)}>{tag.text}</span>
                <span className="min-w-0 flex-1 break-words">
                  {log.message}
                  {log.count && log.count > 1 && (
                    <span className="ml-2 shrink-0 rounded-full bg-[rgba(148,163,184,0.2)] px-1.5 text-[9.5px] text-[#cbd5e1]">×{log.count}</span>
                  )}
                  {isLast && running && <span className="ml-1 inline-block h-3 w-[7px] animate-pulse rounded-sm bg-[var(--acc-hi)] align-[-2px]" />}
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
          <button type="button" onClick={onStop} className="btn danger flex-1">
            <StopCircle className="h-4 w-4" />终止任务
          </button>
          {(["all", "key", "error"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn("fchip", filter === f && "on")}
            >
              {f === "all" ? "全部" : f === "key" ? "关键" : "错误"}
            </button>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
