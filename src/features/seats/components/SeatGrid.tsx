import { Armchair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DynamicSeat } from "@/services/api";

/**
 * 座位网格：按 API 的 x/y 坐标渲染，接近真实布局。
 * 座位不带坐标时退化为顺序流式排布。
 */
export function SeatGrid({
  seats, selectedKey, onSelect, className,
}: {
  seats: DynamicSeat[];
  selectedKey: string;
  onSelect: (key: string, name: string) => void;
  className?: string;
}) {
  const hasCoords = seats.some((s) => s.x > 0 || s.y > 0);
  const maxX = seats.reduce((m, s) => Math.max(m, s.x), 0);
  // 大场馆缩小单元格，避免横向滚动过长
  const cell = seats.length > 300 ? 18 : seats.length > 150 ? 22 : 26;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><Armchair className="h-3 w-3" />共 {seats.length} 座</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-green-500/40 bg-green-500/20" />空闲
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-blue-500 bg-blue-500" />已选
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-slate-300 dark:bg-white/15" />占用
          </span>
        </span>
      </div>

      <div
        className={cn(
          "max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]",
          hasCoords ? "grid justify-center" : "flex flex-wrap gap-1.5",
        )}
        style={
          hasCoords
            ? {
                gridTemplateColumns: `repeat(${maxX}, ${cell}px)`,
                gridAutoRows: `${cell}px`,
                gap: "3px",
              }
            : undefined
        }
      >
        {seats.map((seat) => {
          const selected = seat.key === selectedKey;
          const clickable = seat.available;
          return (
            <button
              key={seat.key}
              type="button"
              title={`${seat.name} 号${seat.available ? "" : "（已占用）"}`}
              aria-label={`座位 ${seat.name}${seat.available ? "" : "，已占用"}`}
              aria-pressed={selected}
              disabled={!clickable}
              onClick={() => onSelect(seat.key, seat.name)}
              style={
                hasCoords && seat.x > 0 && seat.y > 0
                  ? { gridColumn: seat.x, gridRow: seat.y }
                  : undefined
              }
              className={cn(
                "flex items-center justify-center rounded-[5px] border text-[9px] font-bold transition-all",
                cell >= 26 ? "min-h-[26px] min-w-[26px]" : cell >= 22 ? "h-[22px] w-[22px]" : "h-[18px] w-[18px] text-[8px]",
                selected
                  ? "border-blue-500 bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.45)]"
                  : clickable
                    ? "cursor-pointer border-green-500/40 bg-green-500/15 text-green-700 hover:scale-110 hover:bg-green-500/30 dark:text-green-300"
                    : "cursor-not-allowed border-transparent bg-slate-300 text-slate-400 dark:bg-white/10 dark:text-slate-500",
              )}
            >
              {seat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
