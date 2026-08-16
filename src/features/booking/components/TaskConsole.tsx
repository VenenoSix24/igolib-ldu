import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle, CheckCircle2, Clock,
  Info, RefreshCw, Rocket, StopCircle, Terminal, Timer, Trash2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatStatusMessage, type LogEntry, type TaskStatus } from "../model/useBookingTask";

interface TaskConsoleProps {
  status: TaskStatus;
  currentPhase: string;
  latestLog: string;
  logs: LogEntry[];
  setLogs: (logs: LogEntry[]) => void;
  countDownStr: string | null;
  onStop: () => void;
}

export function TaskConsole({ status, currentPhase, latestLog, logs, setLogs, countDownStr, onStop }: TaskConsoleProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  // 滚动日志
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col rounded-3xl glass min-h-[420px] lg:min-h-0">
      {/* 头部 */}
      <div className="shrink-0 p-4 md:p-5 border-b border-slate-200/60 dark:border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 dark:text-slate-500">
            <Activity className="w-3 h-3" /> 任务进度
          </h3>
          <span className={cn("text-xs font-mono", (status === "running" || status === "connecting") ? "text-green-500" : "text-slate-300 dark:text-neutral-600")}>
            {(status === "running" || status === "connecting") ? "● 系统在线" : "○ 已准备就绪"}
          </span>
        </div>

        {/* 任务阶段时间线 */}
        {status !== "idle" && (
          <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* 桌面端：横向时间线 */}
            <div className="hidden md:flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl">
              {[
                { key: "waiting", label: "等待中", icon: Timer },
                { key: "countdown", label: "倒计时", icon: Clock },
                { key: "queuing", label: "排队", icon: Activity },
                { key: "reserving", label: "预约", icon: Rocket },
                {
                  key: "done",
                  label: currentPhase === "failed" ? "失败" : (currentPhase === "cancelled" ? "取消" : "完成"),
                  icon: currentPhase === "failed" ? AlertCircle : (currentPhase === "cancelled" ? AlertTriangle : CheckCircle2)
                }
              ].map((step, idx, arr) => {
                const isTerminal = currentPhase === "done" || currentPhase === "failed" || currentPhase === "cancelled";
                const isActive = currentPhase === step.key;

                const isLastStep = idx === arr.length - 1;
                const finalIsActive = isActive || (isLastStep && isTerminal);

                const isPast = !isTerminal && arr.findIndex(s => s.key === currentPhase) > idx;

                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                      finalIsActive && !isTerminal && "bg-blue-500 text-white shadow-lg shadow-blue-500/30",
                      finalIsActive && currentPhase === "done" && "bg-green-500 text-white shadow-lg shadow-green-500/30",
                      finalIsActive && currentPhase === "failed" && "bg-red-500 text-white shadow-lg shadow-red-500/30",
                      finalIsActive && currentPhase === "cancelled" && "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
                      isPast && "bg-slate-200 dark:bg-neutral-700 text-slate-400",
                      !finalIsActive && !isPast && "text-slate-400 dark:text-neutral-500"
                    )}>
                      <Icon className={cn("w-3.5 h-3.5", isActive && !isTerminal && "animate-pulse")} />
                      <span className="hidden lg:inline">{step.label}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={cn(
                        "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                        isPast || isTerminal ? (currentPhase === "failed" ? "bg-red-400" : currentPhase === "cancelled" ? "bg-amber-400" : "bg-green-400") : "bg-slate-200 dark:bg-neutral-700"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 移动端：紧凑显示当前阶段 */}
            <div className="md:hidden flex items-center justify-center gap-3 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl">
              {(() => {
                const phaseMap: Record<string, { label: string; color: string; dot: string }> = {
                  idle: { label: "就绪", color: "text-slate-500", dot: "bg-slate-500" },
                  waiting: { label: "等待执行", color: "text-blue-500", dot: "bg-blue-500" },
                  countdown: { label: "倒计时中", color: "text-cyan-500", dot: "bg-cyan-500" },
                  queuing: { label: "正在排队", color: "text-purple-500", dot: "bg-purple-500" },
                  reserving: { label: "正在预约", color: "text-blue-500", dot: "bg-blue-500" },
                  executing: { label: "执行中", color: "text-orange-500", dot: "bg-orange-500" },
                  start: { label: "开始", color: "text-blue-500", dot: "bg-blue-500" },
                  done: { label: "任务完成", color: "text-green-500", dot: "bg-green-500" },
                  failed: { label: "任务失败", color: "text-red-500", dot: "bg-red-500" },
                  cancelled: { label: "任务已取消", color: "text-amber-500", dot: "bg-amber-500" }
                };
                const phase = phaseMap[currentPhase] || { label: currentPhase, color: "text-slate-500", dot: "bg-slate-500" };
                const isTerminal = ["done", "failed", "cancelled"].includes(currentPhase);

                return (
                  <>
                    <div className={cn("w-2 h-2 rounded-full", !isTerminal && "animate-pulse", phase.dot)} />
                    <span className={cn("text-sm font-bold", phase.color)}>{phase.label}</span>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* 实时倒计时显示 */}
        {countDownStr && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-100 dark:border-neutral-700 flex justify-between items-center animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>距离计划执行</span>
            </div>
            <div className="font-mono text-xl font-black text-neutral-700 dark:text-slate-200 tracking-widest tabular-nums">
              {countDownStr}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
            status === "running" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
              status === "success" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                status === "failed" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-slate-100 text-slate-400 dark:bg-neutral-800"
          )}>
            {status === "running" ? <Timer className="w-6 h-6 animate-pulse" /> :
              status === "success" ? <CheckCircle2 className="w-6 h-6" /> :
                status === "failed" ? <AlertCircle className="w-6 h-6" /> :
                  <Terminal className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="text-lg md:text-xl font-black text-neutral-800 dark:text-slate-100 tracking-tight leading-none break-all line-clamp-2">
              {formatStatusMessage(latestLog)}
            </div>
            {status === "running" && (
              <p className="text-xs text-blue-500 font-bold mt-1 animate-pulse">正在执行任务逻辑...</p>
            )}
          </div>
          <Button size="icon" variant="ghost" className="ml-auto text-slate-400 hover:text-neutral-600" onClick={() => setLogs([])} title="清空日志">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 可滚动日志 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 font-mono text-sm min-h-[240px]">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <div className="text-6xl grayscale mb-4">☕️</div>
            <p className="text-slate-400 dark:text-neutral-600 font-medium">Ready when you are</p>
          </div>
        ) : (
          <div className="pb-10 space-y-3">
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full"
                >
                  <div className={cn(
                    "flex items-start gap-3 py-2.5 px-4 rounded-lg border-l-3 transition-all hover:bg-black/5 dark:hover:bg-white/5",
                    log.event === "success" && "border-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-900/20 text-green-700 dark:text-green-300",
                    log.event === "error" && "border-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-900/20 text-red-700 dark:text-red-300",
                    (log.event === "warning" || log.event === "cancelled") && "border-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-900/20 text-amber-700 dark:text-amber-300",
                    log.event === "countdown" && "border-cyan-400 bg-gradient-to-r from-cyan-50/30 to-transparent dark:from-cyan-900/10 text-cyan-700 dark:text-cyan-300",
                    log.event === "phase" && "border-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold",
                    log.event === "retry" && "border-orange-400 bg-gradient-to-r from-orange-50/40 to-transparent dark:from-orange-900/15 text-orange-700 dark:text-orange-300",
                    (!log.event || log.event === "info") && "border-slate-300 dark:border-neutral-600 text-neutral-600 dark:text-slate-400"
                  )}>
                    <span className="hidden sm:block shrink-0 font-mono text-[10px] opacity-40 w-[50px] pt-1 select-none text-right">
                      {log.timestamp.split(" ")[0]}
                    </span>

                    <div className="shrink-0 pt-0.5">
                      {log.event === "success" ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                        log.event === "error" ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                          (log.event === "warning" || log.event === "cancelled") ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
                            log.event === "countdown" ? <Timer className="w-4 h-4 text-cyan-500 animate-pulse" /> :
                              log.event === "phase" ? <Zap className="w-4 h-4 text-blue-500" /> :
                                log.event === "retry" ? <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" /> :
                                  <Info className="w-4 h-4 opacity-50" />}
                    </div>

                    <span className="flex-1 text-[13px] sm:text-sm font-medium leading-relaxed break-words font-sans">
                      {log.message}
                      {log.count && log.count > 1 && (
                        <span className="ml-2 inline-flex items-center justify-center bg-slate-200/80 dark:bg-neutral-700/80 text-neutral-600 dark:text-slate-300 h-5 px-2 rounded-full text-[10px] font-bold">
                          ×{log.count}
                        </span>
                      )}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* 运行中的终止按钮 */}
      {(status === "running" || status === "connecting") && (
        <div className="shrink-0 px-4 pb-4 pt-2">
          <Button
            variant="destructive"
            onClick={onStop}
            className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-red-500/20"
          >
            <StopCircle className="w-5 h-5 mr-2" /> 终止任务
          </Button>
        </div>
      )}
    </div>
  );
}
