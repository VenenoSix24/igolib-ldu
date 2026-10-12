import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import type { ExecTime } from "@/stores/settings";

/**
 * 执行档位横条：通栏矮卡。桌面三段（标签 | 档位居中 | 编辑器）；
 * 手机两行（标签+编辑器一行，档位 seg 通栏三等分）。
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
    <GlassCard className="rise p-3.5 md:px-6 md:py-4">
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 md:grid-cols-[auto_1fr_auto] md:gap-6">
        <div className="flex items-center gap-1.5 text-sub">
          <Clock className="h-3.5 w-3.5" />
          <span className="whitespace-nowrap text-[11.5px] font-bold tracking-wide">执行档位</span>
        </div>

        {/* 档位 seg：手机换行通栏三等分，桌面收缩为内容宽度并居中（防背景拉通） */}
        <div className="seg order-3 col-span-2 flex md:order-none md:col-span-1 md:justify-self-center">
          {options.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onExecTime(t)}
              className={cn("flex-1 justify-center whitespace-nowrap md:flex-none md:px-6", execTime === t && "on")}
            >
              {t === "immediate" ? "立即执行" : t === "2148" ? defaultTime : "自定义"}
            </button>
          ))}
        </div>

        {/* 手机第一行右端 = 编辑器/说明；桌面同在右端 */}
        <div className="order-2 flex min-w-0 items-center justify-end md:order-none">
          {editingDefault ? (
            <div className="flex items-center gap-2">
              <span className="hidden whitespace-nowrap text-[11px] font-semibold text-mut sm:block">默认时间</span>
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
            </div>
          ) : editingCustom ? (
            <input
              type="time"
              step="1"
              value={customTime}
              onChange={(e) => onCustomTime(e.target.value)}
              aria-label="自定义执行时间"
              className="input mono h-[30px] w-[140px] text-center text-[12px]"
            />
          ) : (
            <span className="whitespace-nowrap text-[10.5px] text-sub">
              {execTime === "immediate" ? "启动后立即提交" : "到点自动排队"}
            </span>
          )}
        </div>
      </div>
      {editingDefault && (
        <p className="mt-2 text-center text-[10px] text-sub md:hidden">到点自动排队</p>
      )}
    </GlassCard>
  );
}
