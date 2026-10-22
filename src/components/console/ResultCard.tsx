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
          ? "success-sweep border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)]"
          : "border-[rgba(244,63,94,0.35)] bg-[rgba(244,63,94,0.08)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {kind === "success" ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-ok-ink dark:text-[#6ee7b7]" />
        ) : (
          <XCircle className="h-6 w-6 shrink-0 text-err-ink dark:text-[#fda4af]" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-[13.5px] font-bold",
            kind === "success" ? "text-ok-ink dark:text-[#6ee7b7]" : "text-err-ink dark:text-[#fda4af]",
          )}>
            {title}
          </p>
          {detail && (
            <p className="mt-0.5 break-words text-[11.5px] text-mut">{detail}</p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="关闭结果提示"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-md p-1 text-sub transition-colors hover:bg-[rgba(100,116,139,0.1)] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </GlassCard>
  );
}
