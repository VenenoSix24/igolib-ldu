import { motion, AnimatePresence } from "motion/react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import type { ExecTime } from "@/stores/settings";

/**
 * 执行档位横条：通栏矮卡，桌面单行、手机两行。
 * 默认档支持内联编辑默认时间，自定义档展开时间输入。
 */
export function ExecBar({
  options, execTime, onExecTime, customTime, onCustomTime, defaultTime = "21:48", onDefaultTime,
}: {
  options: ExecTime[];
  execTime: ExecTime;
  onExecTime: (t: ExecTime) => void;
  customTime: string;
  onCustomTime: (t: string) => void;
  defaultTime?: string;
  /** 内联修改默认时间（选中默认档时展开，仅明日页传入） */
  onDefaultTime?: (t: string) => void;
}) {
  const editingDefault = execTime === "2148" && Boolean(onDefaultTime);
  const editingCustom = execTime === "custom";

  return (
    <GlassCard className="rise p-3 md:p-3.5">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-1.5 text-sub">
          <Clock className="h-3.5 w-3.5" />
          <span className="whitespace-nowrap text-[11.5px] font-bold tracking-wide">执行档位</span>
        </div>
        <div className="seg flex-1 md:flex-none">
          {options.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onExecTime(t)}
              className={cn("whitespace-nowrap md:px-4", execTime === t && "on")}
            >
              {t === "immediate" ? "立即执行" : t === "2148" ? defaultTime : "自定义"}
            </button>
          ))}
        </div>
        <div className="min-w-0 md:ml-auto">
          {editingDefault ? (
            <div className="flex items-center justify-between gap-2 md:justify-end">
              <span className="whitespace-nowrap text-[11px] font-semibold text-mut">默认时间</span>
              <input
                type="time"
                value={defaultTime}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{2}:\d{2}$/.test(v)) onDefaultTime?.(v);
                }}
                aria-label="修改默认执行时间"
                className="numinput w-[96px]"
              />
              <span className="hidden whitespace-nowrap text-[10px] text-sub lg:block">到点自动排队</span>
            </div>
          ) : editingCustom ? (
            <input
              type="time"
              step="1"
              value={customTime}
              onChange={(e) => onCustomTime(e.target.value)}
              aria-label="自定义执行时间"
              className="input mono h-[30px] w-full text-center text-[12px] md:w-[128px]"
            />
          ) : (
            <span className="block whitespace-nowrap text-right text-[10.5px] text-sub md:text-left">
              {execTime === "immediate" ? "启动后立即提交" : "到点自动排队"}
            </span>
          )}
        </div>
      </div>
      <AnimatePresence>
        {editingDefault && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-center text-[10px] text-sub md:hidden"
          >
            到点自动排队
          </motion.p>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
