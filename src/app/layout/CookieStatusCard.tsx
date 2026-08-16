import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
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
  const { expiry, remainingText, expiring, expired } = useCookieExpiry(cookieStr, reminderMinutes);

  const invalid = cookieStatus === "invalid";

  const dotCls = expired || invalid
    ? "bg-red-500"
    : expiring
      ? "bg-amber-500"
      : expiry !== null
        ? "bg-emerald-500"
        : "bg-slate-400";

  return (
    <GlassCard
      role="button"
      tabIndex={0}
      onClick={() => navigate("/app/home")}
      onKeyDown={(e) => e.key === "Enter" && navigate("/app/home")}
      title="Cookie 到期状态，点击回首页处理"
      className="hidden shrink-0 cursor-pointer p-3 transition-transform hover:scale-[1.02] md:block"
    >
      <div className="flex items-center gap-1.5 text-[10.5px] tracking-wider text-slate-500 dark:text-slate-300">
        <KeyRound className="h-3 w-3" />Cookie 到期
        <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", dotCls, (expiring || expired || invalid) && "animate-pulse")} />
      </div>
      <div className="mt-1.5">
        {invalid ? (
          <span className="text-[12.5px] font-bold text-red-500">Cookie 无效</span>
        ) : expired ? (
          <span className="text-[12.5px] font-bold text-red-500">已到期</span>
        ) : expiry !== null && remainingText ? (
          <span className={cn("text-[15px] font-extrabold tabular-nums", expiring ? "text-amber-500" : "text-emerald-500")}>
            {remainingText}
          </span>
        ) : (
          <span className="text-[12.5px] font-bold text-slate-400 dark:text-slate-300">未配置</span>
        )}
        {expiry !== null && !invalid && !expired && (
          <span className="mt-0.5 block text-[10px] tabular-nums text-slate-400 dark:text-slate-300">
            到期 {formatExpiry(expiry)}
          </span>
        )}
      </div>
    </GlassCard>
  );
}
