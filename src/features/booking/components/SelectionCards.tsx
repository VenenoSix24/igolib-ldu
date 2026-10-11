import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Armchair, Building2, ChevronDown, Clock, LayoutGrid, Pencil, Pointer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DynamicRoom, DynamicSeat } from "@/services/api";
import type { ExecTime } from "@/stores/settings";
import { SeatGrid } from "@/features/seats/components/SeatGrid";
import { useBackupSeatsStore, EMPTY_BACKUP_CHAIN } from "@/stores/backupSeats";

/** 场馆下拉（明日预约用） */
export function VenueSelect({
  rooms, loading, error, libId, onChange, cookieStr,
}: {
  rooms: DynamicRoom[];
  loading: boolean;
  error: string | null;
  libId: string;
  onChange: (libId: string) => void;
  cookieStr: string;
}) {
  return (
    <div className="field">
      <label className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5" />阅览室
        {rooms.length > 0 && !error && (
          <span className="pill ok ml-1 h-[18px] px-1.5 text-[9.5px]"><span className="dot" />实时</span>
        )}
      </label>
      <div className="relative">
        <select
          aria-label="阅览室"
          className="select cursor-pointer appearance-none pr-9"
          value={libId}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || rooms.length === 0}
        >
          {loading ? (
            <option>正在获取场馆数据…</option>
          ) : rooms.length > 0 ? (
            [...rooms].sort((a, b) => a.name.localeCompare(b.name)).map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}（{room.seatsAvailable} 座可用）
              </option>
            ))
          ) : (
            <option value="">{cookieStr ? "未找到可用场馆" : "请先在首页配置 Cookie"}</option>
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
      </div>
      {error && <p className="text-[11.5px] text-warn-ink dark:text-[#fcd34d]">{error}</p>}
    </div>
  );
}

/** 场馆列表行（立即抢座用：实时余位徽章） */
export function VenueList({
  rooms, loading, error, libId, onChange, cookieStr,
}: {
  rooms: DynamicRoom[];
  loading: boolean;
  error: string | null;
  libId: string;
  onChange: (libId: string) => void;
  cookieStr: string;
}) {
  if (loading) {
    return <p className="py-3 text-center text-[11.5px] text-sub">正在获取实时余位…</p>;
  }
  if (error) {
    return <p className="py-3 text-center text-[11.5px] text-warn-ink dark:text-[#fcd34d]">{error}</p>;
  }
  if (rooms.length === 0) {
    return <p className="py-3 text-center text-[11.5px] text-sub">{cookieStr ? "未找到可用场馆" : "请先在首页配置 Cookie"}</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map((room) => {
        const full = room.seatsAvailable <= 0;
        const closed = !room.isOpen;
        const disabled = full || closed;
        const active = String(room.id) === libId;
        return (
          <button
            key={room.id}
            type="button"
            onClick={() => !disabled && onChange(String(room.id))}
            disabled={disabled}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-left transition-all",
              active
                ? "border-[color-mix(in_srgb,var(--pri)_35%,transparent)] bg-[color-mix(in_srgb,var(--pri)_8%,transparent)]"
                : disabled
                  ? "cursor-not-allowed border-[var(--line2)] bg-[rgba(100,116,139,0.05)] opacity-60"
                  : "cursor-pointer border-[var(--line2)] bg-[var(--glass-2)] hover:border-[color-mix(in_srgb,var(--acc)_45%,transparent)]",
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[rgba(100,116,139,0.12)] text-mut">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">{room.name}</span>
              <span className="block text-[11px] text-mut">
                {closed ? "未开放" : full ? "已满 · 可加入捡漏监控" : "实时余位"}
              </span>
            </span>
            <span className={cn(
              "pill h-[22px] px-2 text-[10.5px]",
              closed ? "slate" : full ? "err" : "ok",
            )}>
              <span className="dot" />{closed ? "关" : full ? "满" : `${room.seatsAvailable} 空`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 座位选择：网格 / 下拉 / 手动输入三态视图 */
export function SeatSelect({
  seats, loading, seatNumber, onSeatNumber, selectedSeatKey, onSelectSeatKey, libId,
}: {
  seats: DynamicSeat[];
  loading: boolean;
  seatNumber: string;
  onSeatNumber: (seat: string) => void;
  selectedSeatKey: string;
  onSelectSeatKey: (key: string, name: string) => void;
  libId: string;
}) {
  // 无座位数据时（如 Cookie 未配 / 明日模式未开放）退化为手动输入
  const manual = seats.length === 0;
  const [view, setView] = useState<"grid" | "list">(manual ? "list" : "grid");
  const backupChain = useBackupSeatsStore((s) => s.chains[libId] ?? EMPTY_BACKUP_CHAIN);

  const switchToList = () => {
    // 切视图时保住已选座位号
    if (selectedSeatKey) {
      const seat = seats.find((s) => s.key === selectedSeatKey);
      if (seat) onSeatNumber(seat.name);
    }
    onSelectSeatKey("", seatNumber);
  };

  return (
    <div className="field">
      <label className="flex items-center gap-1.5">
        <Armchair className="h-3.5 w-3.5" />座位号
        {seats.length > 0 && <span className="ml-1 text-ok-ink dark:text-[#6ee7b7]">（{seats.length} 可选）</span>}
        {!manual && (
          <span className="seg ml-auto p-0.5">
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => (v === "list" && view === "grid" ? switchToList() : setView(v))}
                className={cn("h-6 gap-1 px-2 text-[10.5px]", view === v && "on")}
              >
                {v === "grid" ? <LayoutGrid className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {v === "grid" ? "网格" : "列表"}
              </button>
            ))}
          </span>
        )}
      </label>
      {manual ? (
        <input
          placeholder="001"
          value={seatNumber}
          onChange={(e) => onSeatNumber(e.target.value)}
          autoComplete="off"
          className="input mono text-center tracking-widest"
        />
      ) : view === "grid" ? (
        loading ? (
          <p className="py-3 text-center text-[11.5px] text-sub">正在加载座位布局…</p>
        ) : (
          <SeatGrid
            seats={seats}
            selectedKey={selectedSeatKey}
            onSelect={(key, name) => {
              onSelectSeatKey(key, name);
              if (name) onSeatNumber(name);
            }}
            backupKeys={backupChain.map((b) => b.key)}
            onToggleBackup={(key, name) => useBackupSeatsStore.getState().toggle(libId, { key, name })}
          />
        )
      ) : (
        <div className="relative">
          <select
            aria-label="座位号"
            className="select mono cursor-pointer appearance-none pr-9"
            value={selectedSeatKey}
            disabled={loading}
            onChange={(e) => {
              const seat = seats.find((s) => s.key === e.target.value);
              onSelectSeatKey(e.target.value, seat?.name ?? "");
            }}
          >
            {loading ? (
              <option>加载中…</option>
            ) : (
              <>
                <option value="">选择座位…</option>
                {[...seats]
                  .sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh-CN", { numeric: true }))
                  .map((seat) => (
                    <option key={seat.key} value={seat.key}>{seat.name}</option>
                  ))}
              </>
            )}
          </select>
          <Pointer className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
        </div>
      )}
    </div>
  );
}

/** 执行时间卡：立即 / 模式默认 / 自定义（按页面取用不同选项） */
export function TimeCard({
  options, execTime, onExecTime, customTime, onCustomTime, hint, defaultTime = "21:48", onDefaultTime,
}: {
  options: ExecTime[];
  execTime: ExecTime;
  onExecTime: (t: ExecTime) => void;
  customTime: string;
  onCustomTime: (t: string) => void;
  hint?: string;
  defaultTime?: string;
  /** 内联修改默认时间（选中默认档时展开） */
  onDefaultTime?: (t: string) => void;
}) {
  return (
    <div className="field">
      <label className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />执行时间
        {hint && <span className="chip glassy ml-auto py-0.5 text-[10px]">{hint}</span>}
      </label>
      <div className="seg w-full">
        {options.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onExecTime(t)}
            className={cn("flex-1 whitespace-nowrap", execTime === t && "on")}
          >
            {t === "immediate" ? "立即执行" : t === "2148" ? defaultTime : "自定义"}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {execTime === "2148" && onDefaultTime && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3 py-2">
              <span className="text-[11.5px] font-semibold">默认时间</span>
              <input
                type="time"
                value={defaultTime}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{2}:\d{2}$/.test(v)) onDefaultTime(v);
                }}
                aria-label="修改默认执行时间"
                className="numinput ml-auto w-[104px] border-none bg-transparent"
              />
              <span className="text-[10px] text-sub">到点自动排队</span>
            </div>
          </motion.div>
        )}
        {execTime === "custom" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <input
              type="time"
              step="1"
              value={customTime}
              onChange={(e) => onCustomTime(e.target.value)}
              aria-label="自定义执行时间"
              className="input mono text-center"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
