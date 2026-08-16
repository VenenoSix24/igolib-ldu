import { useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, History, Play, Radar, Square, X } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDynamicRooms, type DynamicRoom } from "@/services/api";
import { useSettingsStore } from "@/stores/settings";
import { useScannerStore } from "@/stores/scanner";
import { useScannerLoop } from "../model/useScannerLoop";
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

  return (
    <div className="flex flex-col gap-4">
      {/* 扫描状态 */}
      <GlassCard className="p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            running ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
          )}>
            <Radar className={cn("h-5 w-5", running && "animate-pulse")} />
          </div>
          <div className="flex-1">
            <h2 className="text-[15px] font-bold">场馆捡漏</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-300">
              {running
                ? `第 ${rounds} 轮 · 正在扫描 ${venues.find((v) => v.libId === currentLibId)?.name ?? "…"} · 间隔 ${interval}s`
                : `按优先级轮询勾选场馆的余位，命中即自动预约并通知 · 间隔 ${interval}s（下方可调）`}
            </p>
          </div>
          {running ? (
            <Button variant="destructive" size="sm" onClick={stop}>
              <Square className="mr-1 h-3.5 w-3.5" />停止扫描
            </Button>
          ) : (
            <Button size="sm" disabled={!cookieReady || venues.length === 0} onClick={start}>
              <Play className="mr-1 h-3.5 w-3.5" />开始扫描
            </Button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] text-red-600 dark:text-red-400">{error}</p>
        )}
        {!cookieReady && !running && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-300">
            请先在首页完成扫码登录，再开启捡漏扫描。
          </p>
        )}

        {/* 选中场馆实时余位 */}
        {venueStatuses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {venueStatuses.map((v) => (
              <span
                key={v.libId}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  v.libId === currentLibId && "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300",
                  v.libId !== currentLibId && v.available > 0 && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  v.libId !== currentLibId && v.available <= 0 && "border-slate-300/60 bg-slate-500/5 text-slate-500 dark:border-white/10 dark:text-slate-300"
                )}
              >
                {v.name}
                {v.available < 0 ? " · 未开放" : ` · 余 ${v.available}`}
              </span>
            ))}
          </div>
        )}
      </GlassCard>

      {/* 场馆配置 */}
      <GlassCard className="p-4 md:p-5">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-300">
          <Activity className="h-3.5 w-3.5" />监控场馆（自上而下扫描）
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
              className="h-7 w-14 rounded-lg border border-slate-200 bg-white/80 px-1.5 text-center font-mono text-[11.5px] tabular-nums text-slate-800 focus:border-sky-500 focus:outline-none dark:border-white/15 dark:bg-white/[0.08] dark:text-slate-100"
            />
            <span className="text-[10.5px] text-slate-500 dark:text-slate-300">秒 / 轮（下限 3s）</span>
          </span>
        </div>
        {venues.length > 0 && (
          <button
            type="button"
            onClick={clearVenues}
            className="mb-2 cursor-pointer text-[10.5px] text-slate-400 transition-colors hover:text-red-500"
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
                className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/25 text-[10px] font-extrabold text-sky-700 dark:text-sky-300">
                  {i + 1}
                </span>
                <span className="flex-1 text-[12.5px] font-bold text-sky-800 dark:text-sky-200">{v.name}</span>
                {running && v.libId === currentLibId && (
                  <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">扫描中…</span>
                )}
                <span className="flex gap-0.5">
                  <button
                    type="button"
                    aria-label={`上移 ${v.name}`}
                    disabled={i === 0}
                    onClick={() => moveVenue(v.libId, -1)}
                    className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`下移 ${v.name}`}
                    disabled={i === venues.length - 1}
                    onClick={() => moveVenue(v.libId, 1)}
                    className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`移除 ${v.name}`}
                    onClick={() => removeVenue(v.libId)}
                    className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
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
          <p className="py-2 text-center text-[11px] text-slate-400">场馆加载中…</p>
        ) : allRooms.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-400">无可选场馆（需有效 Cookie）</p>
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
                    "cursor-pointer rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
                    checked
                      ? "border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                      : "border-slate-300/60 bg-slate-500/5 text-slate-600 hover:border-sky-500/40 dark:border-white/10 dark:text-slate-300"
                  )}
                >
                  {room.name}
                  {!room.isOpen && <span className="ml-1 text-[10px] opacity-60">关</span>}
                </button>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* 命中历史 */}
      <GlassCard className="p-4 md:p-5">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-300">
          <History className="h-3.5 w-3.5" />命中记录
          {hits.length > 0 && (
            <button
              type="button"
              onClick={clearHits}
              className="ml-auto cursor-pointer text-[10.5px] text-slate-400 transition-colors hover:text-red-500"
            >
              清空
            </button>
          )}
        </div>
        {hits.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-400">暂无记录，开启扫描后发现空位会记在这里</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {hits.map((hit) => (
              <li
                key={hit.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]",
                  hit.kind === "booked" && "border-emerald-500/40 bg-emerald-500/10",
                  hit.kind === "found" && "border-amber-500/30 bg-amber-500/10",
                  hit.kind === "failed" && "border-red-500/30 bg-red-500/10"
                )}
              >
                <span className="font-mono text-[10.5px] text-slate-400">{formatTime(hit.time)}</span>
                <span className="font-semibold">{hit.libName}</span>
                {hit.seatName && <span className="font-mono font-bold">{hit.seatName} 号</span>}
                <span className="ml-auto text-slate-500 dark:text-slate-300">{hit.message}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
