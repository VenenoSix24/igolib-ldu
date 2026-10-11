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

/** 表盘中心的极短剩余文案（完整时长见到期时间戳） */
function compactRemaining(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}天`;
  if (h > 0) return `${h}时`;
  return `${m}分`;
}

/**
 * 到期表盘：外圈刻度环 + 内圈进度弧。
 * 进度弧表示最后 24 小时的消耗（剩余 >24h 满环，随临近到期排空）。
 */
function Dial({ ratio, tone, label }: { ratio: number; tone: "ok" | "warn" | "err"; label: string }) {
  const R = 24;
  const C = 2 * Math.PI * R;
  const stroke = { ok: "var(--ok)", warn: "var(--warn)", err: "var(--err)" }[tone];
  return (
    <div className="dial">
      <svg viewBox="0 0 62 62" aria-hidden="true">
        <circle cx="31" cy="31" r="28.5" fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="1.5 4.5" />
        <circle cx="31" cy="31" r={R} fill="none" stroke="var(--line2)" strokeWidth="3.5" />
        <circle
          cx="31" cy="31" r={R} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${C * ratio} ${C}`} transform="rotate(-90 31 31)"
        />
      </svg>
      <span className="dt">{label}</span>
    </div>
  );
}

/** 侧栏下方的独立 Cookie 到期状态卡（桌面端）；点击回首页处理 */
export function CookieStatusCard() {
  const navigate = useNavigate();
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const reminderMinutes = useSettingsStore((s) => s.prefs.cookieReminderMinutes);
  const cookieStatus = useAuthStore((s) => s.cookieStatus);
  const { expiry, remainingText, remaining, expiring, expired } = useCookieExpiry(cookieStr, reminderMinutes);

  const invalid = cookieStatus === "invalid";
  const tone: "ok" | "warn" | "err" = expired || invalid ? "err" : expiring ? "warn" : "ok";
  const ratio = expiry !== null && !expired ? Math.min(1, Math.max(0, (remaining ?? 0) / 86_400_000)) : 0;

  const dotCls = tone === "err" ? "bg-[var(--err)]" : tone === "warn" ? "bg-[var(--warn)]" : "bg-[var(--ok)]";
  const numCls = tone === "err"
    ? "text-err-ink dark:text-[#fda4af]"
    : tone === "warn"
      ? "text-warn-ink dark:text-[#fcd34d]"
      : "text-ok-ink dark:text-[#6ee7b7]";

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
        <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", dotCls, tone !== "ok" && "animate-pulse")} />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {invalid ? (
            <span className="text-[12.5px] font-bold text-err-ink dark:text-[#fda4af]">Cookie 无效</span>
          ) : expired ? (
            <span className="text-[12.5px] font-bold text-err-ink dark:text-[#fda4af]">已到期</span>
          ) : expiry !== null && remainingText ? (
            <>
              <span className={cn("mono block text-[15px] font-extrabold", numCls)}>{compactRemaining(remaining!)}</span>
              <span className="mt-0.5 block text-[10px] tabular-nums text-sub">到期 {formatExpiry(expiry)}</span>
            </>
          ) : (
            <span className="text-[12.5px] font-bold text-sub">未配置</span>
          )}
        </div>
        {expiry !== null && !invalid && !expired && <Dial ratio={ratio} tone={tone} label={compactRemaining(remaining!)} />}
      </div>
    </GlassCard>
  );
}
