import { useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, Building2, History, Play, Square, X } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { CardHead } from "@/components/glass/CardHead";
import { cn } from "@/lib/utils";
import { getDynamicRooms, type DynamicRoom } from "@/services/api";
import { useSettingsStore } from "@/stores/settings";
import { useScannerStore } from "@/stores/scanner";
import { useScannerLoop } from "../model/useScannerLoop";
import { ScopeConsoleCard } from "@/components/console/ScopeConsoleCard";
import { ResultCard } from "@/components/console/ResultCard";
import { useAuthStore, cookieBlocked } from "@/stores/auth";

function formatTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function ScannerPage() {
  const apiConfig = useSettingsStore((s) => s.api);
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const scanIntervalSec = useSettingsStore((s) => s.prefs.scanIntervalSec);
  const setPrefs = useSettingsStore((s) => s.setPrefs);

  const venues = useScannerStore((s) => s.venues);
  const hits = useScannerStore((s) => s.hits);
  const { toggleVenue, moveVenue, removeVenue, clearVenues, clearHits } = useScannerStore.getState();

  const { running, rounds, currentLibId, venueStatuses, error, interval, start, stop } = useScannerLoop();

  const [allRooms, setAllRooms] = useState<DynamicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [dismissedHitId, setDismissedHitId] = useState<string | null>(null);

  // 场馆列表（勾选用，500ms 防抖）
  useEffect(() => {
    async function fetchRooms() {
      if (!cookieStr || cookieStr.trim().length < 10) {
        setAllRooms([]);
        return;
      }
      if (cookieBlocked(useAuthStore.getState().cookieStatus)) {
        setAllRooms([]);
        return;
      }
      setLoadingRooms(true);
      try {
        const data = await getDynamicRooms(cookieStr.trim(), apiConfig);
        setAllRooms(data.rooms);
      } catch {
        setAllRooms([]);
      } finally {
        setLoadingRooms(false);
      }
    }
    const timer = setTimeout(fetchRooms, 500);
    return () => clearTimeout(timer);
  }, [cookieStr, apiConfig]);

  const cookieReady = Boolean(cookieStr && cookieStr.trim().length >= 10);
  const selectedIds = new Set(venues.map((v) => v.libId));

  const latestOutcome = hits.find((h) => h.kind === "booked" || h.kind === "failed");

  return (
    <div className="flex flex-col gap-4">
      {/* 结果反馈 */}
      {latestOutcome && latestOutcome.id !== dismissedHitId && (
        <ResultCard
          kind={latestOutcome.kind === "booked" ? "success" : "error"}
          title={latestOutcome.kind === "booked" ? "捡漏成功，已自动预约" : "自动预约失败"}
          detail={`${latestOutcome.libName}${latestOutcome.seatName ? ` ${latestOutcome.seatName} 号` : ""} · ${latestOutcome.message}`}
          onClose={() => setDismissedHitId(latestOutcome.id)}
        />
      )}

      {/* 扫描 hero */}
      <GlassCard className="hero rise p-5 md:p-7">
        <div className="md:flex md:items-center md:gap-8">
          <div className="min-w-0 flex-1">
            <div className="trigger-label">
              <span className="t">场馆捡漏</span>
              <span className="mode">{running ? `第 ${rounds} 轮` : "待命中"}</span>
            </div>
            <div className="bigtime">
              <span className="shimmer text-[30px] md:text-[38px]">{running ? rounds : "-- 轮"}</span>
              <span className="cap">{running ? `轮 · 间隔 ${interval}s` : "轮询已选场馆余位"}</span>
            </div>
            {venueStatuses.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {venueStatuses.map((v) => (
                  <span
                    key={v.libId}
                    className={
                      v.libId === currentLibId
                        ? "pill pri"
                        : v.available > 0
                          ? "pill ok"
                          : "pill slate"
                    }
                  >
                    {v.libId === currentLibId ? <span className="ping" /> : <span className="dot" />}
                    {v.name}
                    {v.available < 0 ? " · 未开放" : ` · 余 ${v.available}`}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-5 shrink-0 md:mt-0 md:w-[200px]">
            {running ? (
              <button type="button" className="btn danger big w-full" onClick={stop}>
                <Square className="h-4 w-4" />停止扫描
              </button>
            ) : (
              <button type="button" className="btn grad big w-full" disabled={!cookieReady || venues.length === 0} onClick={start}>
                <Play className="h-4 w-4" />开始扫描
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="mt-4 rounded-[14px] border border-[rgba(244,63,94,0.25)] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-[11.5px] text-err-ink dark:text-[#fda4af]">{error}</p>
        )}
        {!cookieReady && !running && (
          <p className="mt-3 rounded-[14px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-[11.5px] text-warn-ink dark:text-[#fcd34d]">
            请先在首页完成扫码登录，再开启捡漏扫描。
          </p>
        )}
      </GlassCard>

      {/* 监控场馆 / 命中记录 */}
      <div className="grid items-start gap-4 md:grid-cols-2">

      {/* 场馆配置 */}
      <GlassCard className="rise p-4 md:p-5">
        <CardHead
          icon={Activity}
          title="监控场馆"
          hint={
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                min={3}
                max={300}
                aria-label="捡漏扫描间隔（秒）"
                value={scanIntervalSec}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setPrefs({ scanIntervalSec: Math.max(3, Math.min(300, Math.round(v))) });
                }}
                className="numinput w-14"
              />
              <span className="whitespace-nowrap text-[10px] text-sub">秒 / 轮 · 下限 3s</span>
            </span>
          }
        />
        <div className="mt-3">
        {venues.length > 0 && (
          <button
            type="button"
            onClick={clearVenues}
            className="mb-2 cursor-pointer text-[10.5px] text-sub transition-colors hover:text-err"
          >
            清空已选场馆
          </button>
        )}

        {/* 已选序列 */}
        {venues.length > 0 && (
          <ol className="mb-3 flex flex-col gap-1.5">
            {venues.map((v, i) => (
              <li
                key={v.libId}
                className="flex items-center gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,var(--pri)_30%,transparent)] bg-[color-mix(in_srgb,var(--pri)_8%,transparent)] px-3 py-2 text-[12px] font-semibold text-pri-text dark:text-acc-hi"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--glass-3)] text-[9.5px] font-bold text-ink">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                {running && v.libId === currentLibId && (
                  <span className="text-[10px] font-bold">扫描中…</span>
                )}
                <span className="flex gap-0.5">
                  <button
                    type="button"
                    aria-label={`上移 ${v.name}`}
                    disabled={i === 0}
                    onClick={() => moveVenue(v.libId, -1)}
                    className="cursor-pointer rounded-md p-1 transition-colors hover:bg-[var(--glass-3)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`下移 ${v.name}`}
                    disabled={i === venues.length - 1}
                    onClick={() => moveVenue(v.libId, 1)}
                    className="cursor-pointer rounded-md p-1 transition-colors hover:bg-[var(--glass-3)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`移除 ${v.name}`}
                    onClick={() => removeVenue(v.libId)}
                    className="cursor-pointer rounded-md p-1 transition-colors hover:bg-[rgba(244,63,94,0.1)] hover:text-err"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* 全部场馆勾选 */}
        {loadingRooms ? (
          <p className="py-2 text-center text-[11px] text-sub">场馆加载中…</p>
        ) : allRooms.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <Building2 className="h-7 w-7 text-[#475569]" />
            <p className="text-[11px] text-sub">无可选场馆（需有效 Cookie）</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allRooms.map((room) => {
              const checked = selectedIds.has(String(room.id));
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleVenue({ libId: String(room.id), name: room.name })}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center rounded-full border px-3 text-[11.5px] font-semibold transition-colors",
                    checked
                      ? "border-[color-mix(in_srgb,var(--pri)_35%,transparent)] bg-[color-mix(in_srgb,var(--pri)_10%,transparent)] text-pri-text dark:text-acc-hi"
                      : "border-[var(--line)] bg-[var(--glass-2)] text-mut hover:border-[color-mix(in_srgb,var(--acc)_50%,transparent)]",
                  )}
                >
                  {room.name}
                  {!room.isOpen && <span className="ml-1 opacity-60">关</span>}
                </button>
              );
            })}
          </div>
        )}
        </div>
      </GlassCard>

      {/* 命中历史 */}
      <GlassCard className="rise p-4 md:p-5">
        <CardHead
          icon={History}
          title="命中记录"
          hint={hits.length > 0 ? (
            <button
              type="button"
              onClick={clearHits}
              className="linklike text-sub hover:text-err"
            >
              清空
            </button>
          ) : undefined}
        />
        <div className="mt-3">
        {hits.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <History className="h-7 w-7 text-[#475569]" />
            <p className="text-[11px] text-sub">暂无记录，开启扫描后发现空位会记在这里</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {hits.map((hit) => (
              <li
                key={hit.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11.5px]",
                  hit.kind === "booked" && "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)]",
                  hit.kind === "found" && "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)]",
                  hit.kind === "failed" && "border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)]",
                )}
              >
                <span className="mono shrink-0 text-[10px] text-sub">{formatTime(hit.time)}</span>
                <span className="font-semibold">{hit.libName}</span>
                {hit.seatName && <span className="mono font-bold">{hit.seatName} 号</span>}
                <span className="ml-auto truncate text-mut">{hit.message}</span>
              </li>
            ))}
          </ul>
        )}
        </div>
      </GlassCard>
      </div>

      {/* 任务控制台 */}
      <ScopeConsoleCard
        scope="捡漏"
        title="捡漏控制台"
        statusText={running ? `第 ${rounds} 轮` : "待命中"}
        running={running}
        subtitle={running
          ? `第 ${rounds} 轮 · 正在扫描 ${venues.find((v) => v.libId === currentLibId)?.name ?? "…"}`
          : "轮询已选场馆余位"}
        stages={{
          labels: venues.map((v) => v.name),
          current: currentLibId ? venues.findIndex((v) => v.libId === currentLibId) : -1,
        }}
      />
    </div>
  );
}
