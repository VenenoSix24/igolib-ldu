import { CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";

/** 任务结果反馈卡：成功 / 失败两种状态，可关闭 */
export function ResultCard({
  kind,
  title,
  detail,
  onClose,
  className,
}: {
  kind: "success" | "error";
  title: string;
  detail?: string;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <GlassCard
      className={cn(
        "border p-4 md:p-5",
        kind === "success"
          ? "border-emerald-500/40 bg-emerald-500/[0.08]"
          : "border-red-500/40 bg-red-500/[0.08]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {kind === "success" ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
        ) : (
          <XCircle className="h-6 w-6 shrink-0 text-red-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-[13.5px] font-bold",
            kind === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
          )}>
            {title}
          </p>
          {detail && (
            <p className="mt-0.5 break-words text-[11.5px] text-slate-600 dark:text-slate-300">{detail}</p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="关闭结果提示"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-white/50 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </GlassCard>
  );
}
