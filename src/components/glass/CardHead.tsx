import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 卡片头：状态图标砖 + 标题 + 右侧提示，全应用统一 */
export function CardHead({
  icon: Icon, tile = "ti-pri", title, hint, className,
}: {
  icon: LucideIcon;
  tile?: string;
  title: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-[10px]", tile)}>
        <Icon className="h-4 w-4" />
      </span>
      <b className="text-[13px] font-bold">{title}</b>
      {hint && <span className="ml-auto">{hint}</span>}
    </div>
  );
}
