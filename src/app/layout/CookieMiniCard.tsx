import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { cn } from "../../lib/utils";
import { useSettingsStore } from "../../stores/settings";
import { useAuthStore } from "../../stores/auth";
import { useCookieExpiry } from "../../lib/useCookieExpiry";

function formatExpiry(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 侧栏底部 Cookie 到期状态卡：点击回首页处理 */
export function CookieMiniCard() {
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
    <button
      type="button"
      onClick={() => navigate("/app/home")}
      title="Cookie 到期状态，点击回首页处理"
      className="mb-2 flex w-full cursor-pointer flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
    >
      <span className="flex items-center gap-1.5 text-[10.5px] tracking-wider opacity-70">
        <KeyRound className="h-3 w-3" />Cookie
        <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", dotCls, (expiring || expired || invalid) && "animate-pulse")} />
      </span>
      {invalid ? (
        <span className="text-[11.5px] font-bold text-red-400">Cookie 无效</span>
      ) : expired ? (
        <span className="text-[11.5px] font-bold text-red-400">已到期</span>
      ) : expiry !== null && remainingText ? (
        <>
          <span className={cn("text-[11.5px] font-bold tabular-nums", expiring ? "text-amber-300" : "text-emerald-300")}>
            剩 {remainingText}
          </span>
          <span className="text-[10px] tabular-nums opacity-60">到期 {formatExpiry(expiry)}</span>
        </>
      ) : (
        <span className="text-[11.5px] font-bold opacity-60">未配置</span>
      )}
    </button>
  );
}
