import { motion } from "motion/react";
import { cn } from "../../lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SlidingTabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 每个容器唯一，指示器跨容器重渲染时保持 FLIP 连续 */
  layoutId: string;
  className?: string;
  itemClassName?: string;
  "aria-label"?: string;
}

/**
 * 带滑动胶囊指示器的 tab 组。
 * layoutId 是框架级 FLIP：同 id 元素无论在哪个容器重建，都从旧位置补间到新位置，
 * 各容器 id 不同即天然 namespace 隔离。
 */
export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  layoutId,
  className,
  itemClassName,
  "aria-label": ariaLabel,
}: SlidingTabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("relative flex", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative z-[1] rounded-full px-4 py-1.5 text-sm transition-colors cursor-pointer",
              active ? "font-semibold text-[#131a2a]" : "opacity-70 hover:opacity-95",
              itemClassName,
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-[1] rounded-full bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_10px_rgba(0,0,0,0.18)]"
                transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
