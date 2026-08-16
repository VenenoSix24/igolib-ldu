import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** 悬停弹性 + 折射增强（仅重点卡片开启，控制 GPU 开销） */
  hoverable?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverable = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("glass relative rounded-3xl", hoverable && "glass-hoverable", className)}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
