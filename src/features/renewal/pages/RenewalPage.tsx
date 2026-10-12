import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Infinity as InfinityIcon, Play, RefreshCw, Square, Timer } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { CardHead } from "@/components/glass/CardHead";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { useReservation } from "@/features/booking/model/useReservation";
import { ReservationCard } from "@/features/booking/components/ReservationCard";
import { useRenewalLoop, type RenewalPhase } from "../model/useRenewalLoop";
import { ScopeConsoleCard } from "@/components/console/ScopeConsoleCard";
import { ResultCard } from "@/components/console/ResultCard";

const PHASE_TEXT: Record<RenewalPhase, string> = {
  idle: "待命中",
  waiting: "等待触发",
  cancelling: "正在取消",
  cooldown: "冷却等待",
  rebooking: "正在重订",
  stopped: "已停止",
};

function StatCell({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--line2)] bg-[var(--glass-2)] px-3 py-2">
      <div className="text-[10px] font-semibold tracking-wider text-sub">{label}</div>
      <div className={cn("mono text-[13px] font-bold tabular-nums", valueCls)}>{value}</div>
    </div>
  );
}

export function RenewalPage() {
  const navigate = useNavigate();
  const apiConfig = useSettingsStore((s) => s.api);
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const prefs = useSettingsStore((s) => s.prefs);
  const setPrefs = useSettingsStore((s) => s.setPrefs);

  const { reservation, loading: loadingReservation, refresh: refreshReservation } =
    useReservation(cookieStr, apiConfig);
  const {
    running, lastResult, phase, rounds, consecutiveFails, nextActionLabel, remainingText, message, libRule,
    start, stop,
  } = useRenewalLoop();

  const [starting, setStarting] = useState(false);
  const [dismissedResultAt, setDismissedResultAt] = useState<number | null>(null);

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
      {/* 结果反馈 */}
      {lastResult && lastResult.time !== dismissedResultAt && (
        <ResultCard
          kind={lastResult.kind}
          title={lastResult.title}
          detail={lastResult.detail}
          onClose={() => setDismissedResultAt(lastResult.time)}
        />
      )}

      {/* 当前预约（常驻：无预约时引导先去抢座） */}
      {reservation?.seatName ? (
        <ReservationCard
          reservation={reservation}
          refreshing={loadingReservation}
          onRefresh={() => void refreshReservation()}
        />
      ) : (
        <GlassCard className="rise flex items-center gap-3 p-4 md:p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[rgba(100,116,139,0.12)] text-mut">
            <InfinityIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold">当前无预约</p>
            <p className="text-[11.5px] text-mut">续约针对已有座位循环保座，请先完成一次预约</p>
          </div>
          <button type="button" className="btn grad sm" onClick={() => navigate("/app/grab")}>
            去抢座
          </button>
        </GlassCard>
      )}

      {/* 续约 hero */}
      <GlassCard className="hero rise p-5 md:p-7">
        <div className="md:flex md:items-center md:gap-8">
          <div className="min-w-0 flex-1">
            <div className="trigger-label">
              <span className="t">占座续约</span>
              <span className="mode">{PHASE_TEXT[phase]}</span>
            </div>
            <div className="bigtime">
              <span className="shimmer text-[30px] md:text-[38px]">{running && remainingText ? remainingText : "--:--"}</span>
              <span className="cap">{running ? (nextActionLabel || "等待下一动作") : "临近截止自动取消重订保座"}</span>
            </div>
          </div>
          <div className="mt-5 shrink-0 md:mt-0 md:w-[200px]">
            {running ? (
              <button type="button" className="btn danger big w-full" onClick={() => stop("手动停止")}>
                <Square className="h-4 w-4" />停止续约
              </button>
            ) : (
              <button type="button" className="btn grad big w-full" disabled={!cookieReady || starting} onClick={() => void doStart()}>
                <Play className="h-4 w-4" />{starting ? "启动中…" : "开始续约"}
              </button>
            )}
          </div>
        </div>

        {/* 状态行 */}
        <div className="mt-6 grid grid-cols-2 gap-2 border-t border-[var(--line2)] pt-5 md:grid-cols-4">
          <StatCell
            label="状态"
            value={PHASE_TEXT[phase]}
            valueCls={running ? "text-ok-ink dark:text-[#6ee7b7]" : undefined}
          />
          <StatCell label="已完成轮次" value={String(rounds)} />
          <StatCell
            label="连续失败"
            value={`${consecutiveFails} / 3`}
            valueCls={consecutiveFails > 0 ? "text-err-ink dark:text-[#fda4af]" : undefined}
          />
          <StatCell
            label={nextActionLabel || "下一动作"}
            value={running && remainingText ? remainingText : "--:--"}
          />
        </div>

        {message && (
          <p className="mt-3 rounded-[14px] border border-[var(--line2)] bg-[var(--glass-2)] px-3 py-2 text-[11.5px] text-mut">{message}</p>
        )}
        {!cookieReady && !running && (
          <p className="mt-3 rounded-[14px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-[11.5px] text-warn-ink dark:text-[#fcd34d]">
            请先在首页完成扫码登录，再开启续约。
          </p>
        )}
      </GlassCard>

      {/* 循环参数 / 场馆规则 */}
      <div className={cn("grid items-start gap-4", libRule ? "md:grid-cols-2" : "md:grid-cols-1")}>
        <GlassCard className="rise p-4 md:p-5">
          <CardHead icon={Timer} tile="ti-slate" title="循环参数" />
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3 py-2.5">
              <span className="whitespace-nowrap text-[12px] font-semibold">取消后等待（秒）</span>
              <input
                type="number"
                min={0}
                max={600}
                value={prefs.renewalDelaySec}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setPrefs({ renewalDelaySec: Math.min(600, Math.max(0, Math.round(v))) });
                }}
                className="numinput w-20"
              />
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3 py-2.5">
              <span className="whitespace-nowrap text-[12px] font-semibold">触发提前量（分钟）</span>
              <input
                type="number"
                min={0}
                max={60}
                value={prefs.renewalLeadMinutes}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setPrefs({ renewalLeadMinutes: Math.min(60, Math.max(0, Math.round(v))) });
                }}
                className="numinput w-20"
              />
            </label>
          </div>
          <p className="mt-2 text-[10.5px] text-sub">
            触发时机优先使用服务端返回的下次续约时间（renewTimeNext），无该数据时按「签到截止 − 提前量」计算；连续失败 3 轮自动停止并强提醒。
          </p>
        </GlassCard>

        {libRule && (
          <GlassCard className="rise p-4 md:p-5">
            <CardHead icon={RefreshCw} tile="ti-slate" title="场馆规则" />
            <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
              {libRule.libValidateTime !== undefined && (
                <span className="pill slate"><span className="dot" />签到时限 {libRule.libValidateTime}</span>
              )}
              {libRule.libRenewTime !== undefined && (
                <span className="pill slate"><span className="dot" />续约时限 {libRule.libRenewTime}</span>
              )}
              {libRule.openTimeStr && (
                <span className="pill slate"><span className="dot" />开放 {libRule.openTimeStr} – {libRule.closeTimeStr}</span>
              )}
            </div>
          </GlassCard>
        )}
      </div>

      {/* 任务控制台 */}
      <ScopeConsoleCard
        scope="续约"
        title="续约控制台"
        statusText={running ? PHASE_TEXT[phase] : "待命中"}
        running={running}
        subtitle={running ? `已完成 ${rounds} 轮 · 连续失败 ${consecutiveFails}/3` : "临近签到截止自动取消重订保座"}
        stages={{
          labels: ["等待触发", "取消", "冷却", "重订"],
          current: phase === "waiting" ? 0 : phase === "cancelling" ? 1 : phase === "cooldown" ? 2 : phase === "rebooking" ? 3 : -1,
        }}
      />
    </div>
  );
}
