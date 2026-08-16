import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, LayoutList, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { OpMode, ExecTime } from "@/stores/settings";

interface ModeTimeSectionProps {
  opMode: OpMode;
  setOpMode: (mode: OpMode) => void;
  execTime: ExecTime;
  setExecTime: (time: ExecTime) => void;
  customTime: string;
  setCustomTime: (time: string) => void;
}

export function ModeTimeSection({
  opMode, setOpMode, execTime, setExecTime, customTime, setCustomTime,
}: ModeTimeSectionProps) {
  return (
    <div className="space-y-5">
      {/* 操作模式 */}
      <div className="space-y-3">
        <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 dark:text-slate-400">
          <LayoutList className="w-3 h-3" /> 操作模式
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOpMode("scheduled")}
            className={cn(
              "py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex flex-col items-center gap-1",
              opMode === "scheduled"
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-400"
            )}
          >
            <Calendar className="w-4 h-4" />
            明日预约
          </button>
          <button
            onClick={() => setOpMode("immediate")}
            className={cn(
              "py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex flex-col items-center gap-1",
              opMode === "immediate"
                ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
                : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-400"
            )}
          >
            <Zap className="w-4 h-4" />
            立即抢座
          </button>
        </div>
      </div>

      {/* 执行时间 */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-neutral-800">
        <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 dark:text-slate-400">
          <Clock className="w-3 h-3" /> 执行时间
        </Label>
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-neutral-800 rounded-lg">
          {(["immediate", "2148", "custom"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setExecTime(t)}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-md text-xs font-bold transition-all",
                execTime === t
                  ? "bg-white dark:bg-neutral-600 text-blue-600 dark:text-blue-300 shadow-sm"
                  : "text-slate-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {t === "immediate" ? "立即" : t === "2148" ? "21:48" : "自定义"}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {execTime === "custom" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <Input
                type="time"
                step="1"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="text-center font-mono bg-blue-50/50 border-blue-100 text-blue-700 dark:bg-blue-900/10 dark:border-blue-800 dark:text-blue-300"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
