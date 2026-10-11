import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { cn, compactRemaining } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { Dial } from "@/components/glass/Dial";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useCookieExpiry } from "@/lib/useCookieExpiry";

function formatExpiry(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 侧栏下方的独立 Cookie 到期状态卡（桌面端）；点击回首页处理 */
export function CookieStatusCard() {
  const navigate = useNavigate();
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const reminderMinutes = useSettingsStore((s) => s.prefs.cookieReminderMinutes);
  const cookieStatus = useAuthStore((s) => s.cookieStatus);
  const { expiry, remainingText, remaining, expiring, expired } = useCookieExpiry(cookieStr, reminderMinutes);

  const invalid = cookieStatus === "invalid";
  const hasCookie = expiry !== null && !invalid && !expired;
  const tone: "ok" | "warn" | "err" | "none" = expired || invalid ? "err" : expiring ? "warn" : hasCookie ? "ok" : "none";
  const ratio = hasCookie ? Math.min(1, Math.max(0, (remaining ?? 0) / 86_400_000)) : 0;

  const dotCls = tone === "err"
    ? "bg-[var(--err)]"
    : tone === "warn"
      ? "bg-[var(--warn)]"
      : tone === "ok"
        ? "bg-[var(--ok)]"
        : "bg-[rgba(100,116,139,0.4)]";

  return (
    <GlassCard
      role="button"
      tabIndex={0}
      onClick={() => navigate("/app/home")}
      onKeyDown={(e) => e.key === "Enter" && navigate("/app/home")}
      title="Cookie 到期状态，点击回首页处理"
      className="hidden shrink-0 cursor-pointer p-3.5 transition-transform hover:scale-[1.02] md:block"
    >
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wider text-mut">
        <KeyRound className="h-3 w-3" />Cookie 到期
        <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", dotCls, (tone === "err" || tone === "warn") && "animate-pulse")} />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {invalid ? (
            <span className="text-[12.5px] font-bold text-err-ink dark:text-[#fda4af]">Cookie 无效</span>
          ) : expired ? (
            <span className="text-[12.5px] font-bold text-err-ink dark:text-[#fda4af]">已到期</span>
          ) : expiry !== null && remainingText ? (
            <>
              <span className={cn(
                "mono block text-[15px] font-extrabold",
                expiring ? "text-warn-ink dark:text-[#fcd34d]" : "text-ok-ink dark:text-[#6ee7b7]",
              )}>
                {compactRemaining(remaining!)}
              </span>
              <span className="mt-0.5 block text-[10px] tabular-nums text-sub">到期 {formatExpiry(expiry)}</span>
            </>
          ) : (
            <span className="text-[12.5px] font-bold text-sub">未配置</span>
          )}
        </div>
        {hasCookie && <Dial ratio={ratio} tone={expiring ? "warn" : "ok"} label={compactRemaining(remaining!)} />}
      </div>
    </GlassCard>
  );
}
