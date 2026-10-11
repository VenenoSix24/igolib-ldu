import { useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, History, Play, Radar, Square, X } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
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

      {/* 扫描状态 */}
      <GlassCard className="rise p-4 md:p-5">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[14px]", running ? "ti-emerald" : "ti-amber")}>
            <Radar className={cn("h-5 w-5", running && "animate-pulse")} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold">场馆捡漏</h2>
            <p className="text-[11px] text-mut">
              {running
                ? `第 ${rounds} 轮 · 正在扫描 ${venues.find((v) => v.libId === currentLibId)?.name ?? "…"} · 间隔 ${interval}s`
                : `按优先级轮询勾选场馆的余位，命中即自动预约并通知 · 间隔 ${interval}s（下方可调）`}
            </p>
          </div>
          {running ? (
            <button type="button" className="btn danger sm" onClick={stop}>
              <Square className="h-3.5 w-3.5" />停止扫描
            </button>
          ) : (
            <button type="button" className="btn grad sm" disabled={!cookieReady || venues.length === 0} onClick={start}>
              <Play className="h-3.5 w-3.5" />开始扫描
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-[14px] border border-[rgba(244,63,94,0.25)] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-[11.5px] text-err-ink dark:text-[#fda4af]">{error}</p>
        )}
        {!cookieReady && !running && (
          <p className="mt-3 rounded-[14px] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-[11.5px] text-warn-ink dark:text-[#fcd34d]">
            请先在首页完成扫码登录，再开启捡漏扫描。
          </p>
        )}

        {/* 选中场馆实时余位 */}
        {venueStatuses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
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
      </GlassCard>

      {/* 场馆配置 */}
      <GlassCard className="rise p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-sub">
          <Activity className="h-3.5 w-3.5" />监控场馆（按顺序轮询）
          <span className="ml-auto flex items-center gap-1.5">
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
            <span className="whitespace-nowrap text-[10.5px]">秒 / 轮（下限 3s）</span>
          </span>
        </div>
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
          <p className="py-2 text-center text-[11px] text-sub">无可选场馆（需有效 Cookie）</p>
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
      </GlassCard>

      {/* 命中历史 */}
      <GlassCard className="rise p-4 md:p-5">
        <div className="mb-3 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-sub">
          <History className="h-3.5 w-3.5" />命中记录
          {hits.length > 0 && (
            <button
              type="button"
              onClick={clearHits}
              className="ml-auto cursor-pointer text-[10.5px] transition-colors hover:text-err"
            >
              清空
            </button>
          )}
        </div>
        {hits.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-sub">暂无记录，开启扫描后发现空位会记在这里</p>
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
      </GlassCard>

      {/* 任务控制台 */}
      <ScopeConsoleCard
        scope="捡漏"
        title="捡漏控制台"
        statusText={running ? `第 ${rounds} 轮` : "待命"}
        running={running}
      />
    </div>
  );
}
