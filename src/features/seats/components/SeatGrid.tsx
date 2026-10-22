import { useRef } from "react";
import { Armchair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DynamicSeat } from "@/services/api";

/**
 * 座位网格：按 API 的 x/y 坐标渲染，接近真实布局。
 * 座位不带坐标时退化为顺序流式排布。
 * 点击 = 主选；长按 / 右键 = 加入（或移出）备选链。
 */
export function SeatGrid({
  seats, selectedKey, onSelect, backupKeys, onToggleBackup, className,
}: {
  seats: DynamicSeat[];
  selectedKey: string;
  onSelect: (key: string, name: string) => void;
  backupKeys?: string[];
  onToggleBackup?: (key: string, name: string) => void;
  className?: string;
}) {
  const hasCoords = seats.some((s) => s.x > 0 || s.y > 0);
  const maxX = seats.reduce((m, s) => Math.max(m, s.x), 0);
  // 大场馆缩小单元格，避免横向滚动过长
  const cell = seats.length > 300 ? 18 : seats.length > 150 ? 22 : 26;
  const backupSet = new Set(backupKeys ?? []);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between text-[10px] text-sub">
        <span className="flex items-center gap-1"><Armchair className="h-3 w-3" />共 {seats.length} 座</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.14)]" />空闲
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[var(--pri)] bg-[var(--pri)]" />已选
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[var(--acc)] bg-[color-mix(in_srgb,var(--acc)_22%,transparent)]" />备选
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[rgba(100,116,139,0.18)]" />占用
          </span>
        </span>
      </div>

      <div
        className={cn(
          "max-h-64 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--glass-2)] p-3",
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
          const inBackup = backupSet.has(seat.key);
          const clickable = seat.available;
          return (
            <button
              key={seat.key}
              type="button"
              title={`${seat.name} 号${inBackup ? "（备选）" : seat.available ? "" : "（已占用）"}：点击主选，长按/右键加入备选`}
              aria-label={`座位 ${seat.name}${inBackup ? "，备选" : seat.available ? "" : "，已占用"}`}
              aria-pressed={selected}
              disabled={!clickable}
              onClick={() => {
                // 长按刚触发过备选切换时不再触发主选
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                onSelect(seat.key, seat.name);
              }}
              onContextMenu={(e) => {
                if (!clickable || !onToggleBackup) return;
                e.preventDefault();
                onToggleBackup(seat.key, seat.name);
              }}
              onPointerDown={() => {
                if (!clickable || !onToggleBackup) return;
                longPressed.current = false;
                pressTimer.current = setTimeout(() => {
                  longPressed.current = true;
                  onToggleBackup(seat.key, seat.name);
                }, 500);
              }}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              style={
                hasCoords && seat.x > 0 && seat.y > 0
                  ? { gridColumn: seat.x, gridRow: seat.y }
                  : undefined
              }
              className={cn(
                "flex touch-none select-none items-center justify-center rounded-[6px] border text-[9px] font-bold transition-all",
                cell >= 26 ? "min-h-[26px] min-w-[26px]" : cell >= 22 ? "h-[22px] w-[22px]" : "h-[18px] w-[18px] text-[8px]",
                selected
                  ? "border-[var(--pri)] bg-[var(--pri)] text-[var(--pri-ink)] shadow-[0_2px_8px_color-mix(in_srgb,var(--pri)_45%,transparent)]"
                  : inBackup
                    ? "cursor-pointer border-[var(--acc)] bg-[color-mix(in_srgb,var(--acc)_22%,transparent)] text-pri-text dark:text-acc-hi"
                    : clickable
                      ? "cursor-pointer border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.14)] text-ok-ink hover:scale-110 hover:bg-[rgba(16,185,129,0.28)] dark:text-[#6ee7b7]"
                      : "cursor-not-allowed border-transparent bg-[rgba(100,116,139,0.15)] text-sub",
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
