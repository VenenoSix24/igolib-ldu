import { useEffect, useState } from "react";
import { Infinity as InfinityIcon, Play, RefreshCw, Square, Timer } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { useReservation } from "@/features/booking/model/useReservation";
import { ReservationCard } from "@/features/booking/components/ReservationCard";
import { useRenewalLoop, type RenewalPhase } from "../model/useRenewalLoop";

const PHASE_TEXT: Record<RenewalPhase, string> = {
  idle: "待命",
  waiting: "等待触发",
  cancelling: "正在取消",
  cooldown: "冷却等待",
  rebooking: "正在重订",
  stopped: "已停止",
};

export function RenewalPage() {
  const apiConfig = useSettingsStore((s) => s.api);
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const prefs = useSettingsStore((s) => s.prefs);
  const setPrefs = useSettingsStore((s) => s.setPrefs);

  const { reservation, loading: loadingReservation, refresh: refreshReservation } =
    useReservation(cookieStr, apiConfig);
  const {
    running, phase, rounds, consecutiveFails, nextActionLabel, remainingText, message, libRule,
    start, stop,
  } = useRenewalLoop();

  const [starting, setStarting] = useState(false);

  // 续约轮次完成后刷新当前预约
  useEffect(() => {
    if (rounds > 0) void refreshReservation();
  }, [rounds, refreshReservation]);

  const cookieReady = Boolean(cookieStr && cookieStr.trim().length >= 10);

  const doStart = async () => {
    setStarting(true);
    try {
      await start();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 当前预约 */}
      {reservation?.seatName && (
        <ReservationCard
          reservation={reservation}
          refreshing={loadingReservation}
          onRefresh={() => void refreshReservation()}
        />
      )}

      {/* 续约控制 */}
      <GlassCard className="p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            running ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-sky-500/15 text-sky-600 dark:text-sky-300"
          )}>
            <InfinityIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-[15px] font-bold">占座续约</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-300">
              临近签到截止自动「取消 → 等待 → 重订」循环保座；重订优先原座位与备选链
            </p>
          </div>
          {running ? (
            <Button variant="destructive" size="sm" onClick={() => stop("手动停止")}>
              <Square className="mr-1 h-3.5 w-3.5" />停止续约
            </Button>
          ) : (
            <Button size="sm" disabled={!cookieReady || starting} onClick={() => void doStart()}>
              <Play className="mr-1 h-3.5 w-3.5" />{starting ? "启动中…" : "开始续约"}
            </Button>
          )}
        </div>

        {/* 状态行 */}
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-[10px] tracking-wider text-slate-400">状态</div>
            <div className={cn(
              "text-[13px] font-bold",
              running ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"
            )}>
              {PHASE_TEXT[phase]}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-[10px] tracking-wider text-slate-400">已完成轮次</div>
            <div className="text-[13px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{rounds}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-[10px] tracking-wider text-slate-400">连续失败</div>
            <div className={cn(
              "text-[13px] font-bold tabular-nums",
              consecutiveFails > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"
            )}>
              {consecutiveFails} / 3
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="text-[10px] tracking-wider text-slate-400">{nextActionLabel || "下一动作"}</div>
            <div className="text-[13px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
              {running && remainingText ? remainingText : "--:--"}
            </div>
          </div>
        </div>

        {message && (
          <p className="mt-3 rounded-lg bg-slate-500/10 px-3 py-2 text-[11.5px] text-slate-600 dark:text-slate-300">{message}</p>
        )}
        {!cookieReady && !running && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-300">
            请先在首页完成扫码登录，再开启续约。
          </p>
        )}
      </GlassCard>

      {/* 循环参数 */}
      <GlassCard className="p-4 md:p-5">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-300">
          <Timer className="h-3.5 w-3.5" />循环参数
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <span className="text-[12px] font-semibold">取消后等待（秒）</span>
            <input
              type="number"
              min={0}
              max={600}
              value={prefs.renewalDelaySec}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setPrefs({ renewalDelaySec: Math.min(600, Math.max(0, Math.round(v))) });
              }}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-[12px] tabular-nums outline-none focus:border-sky-500 dark:border-white/10 dark:bg-white/[0.06]"
            />
          </label>
          <label className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <span className="text-[12px] font-semibold">触发提前量（分钟）</span>
            <input
              type="number"
              min={0}
              max={60}
              value={prefs.renewalLeadMinutes}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setPrefs({ renewalLeadMinutes: Math.min(60, Math.max(0, Math.round(v))) });
              }}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-[12px] tabular-nums outline-none focus:border-sky-500 dark:border-white/10 dark:bg-white/[0.06]"
            />
          </label>
        </div>
        <p className="mt-2 text-[10.5px] text-slate-400">
          触发时机优先取服务端 renewTimeNext，无该数据时按「签到截止 − 提前量」计算；连续失败 3 轮自动停止并强提醒。
        </p>
      </GlassCard>

      {/* 场馆规则 */}
      {libRule && (
        <GlassCard className="p-4 md:p-5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-300">
            <RefreshCw className="h-3.5 w-3.5" />场馆规则
          </div>
          <div className="flex flex-wrap gap-2 text-[11.5px]">
            {libRule.libValidateTime !== undefined && (
              <span className="rounded-full border border-slate-300/60 bg-slate-500/5 px-2.5 py-1 dark:border-white/10">签到时限 {libRule.libValidateTime}</span>
            )}
            {libRule.libRenewTime !== undefined && (
              <span className="rounded-full border border-slate-300/60 bg-slate-500/5 px-2.5 py-1 dark:border-white/10">续约时限 {libRule.libRenewTime}</span>
            )}
            {libRule.openTimeStr && (
              <span className="rounded-full border border-slate-300/60 bg-slate-500/5 px-2.5 py-1 dark:border-white/10">开放 {libRule.openTimeStr} – {libRule.closeTimeStr}</span>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
