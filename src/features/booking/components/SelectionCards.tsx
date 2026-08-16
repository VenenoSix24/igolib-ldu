import { AnimatePresence, motion } from "motion/react";
import { Armchair, Building2, ChevronDown, Clock, Pencil, Pointer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DynamicRoom, DynamicSeat } from "@/services/api";
import type { ExecTime } from "@/stores/settings";

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
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-400">
        <Building2 className="h-3.5 w-3.5" />阅览室
        {rooms.length > 0 && !error && <span className="text-[10px] font-normal text-green-500">✓ 实时</span>}
      </label>
      <div className="relative">
        <select
          aria-label="阅览室"
          className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white/70 px-3 pr-9 text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-100"
          value={libId}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || rooms.length === 0}
        >
          {loading ? (
            <option>正在获取最新馆藏数据...</option>
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
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {error && <p className="text-xs text-amber-500">{error}</p>}
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
    return <p className="py-3 text-center text-xs text-slate-400">正在获取实时余位…</p>;
  }
  if (error) {
    return <p className="py-3 text-center text-xs text-amber-500">{error}</p>;
  }
  if (rooms.length === 0) {
    return <p className="py-3 text-center text-xs text-slate-400">{cookieStr ? "未找到可用场馆" : "请先在首页配置 Cookie"}</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map((room) => {
        const full = room.seatsAvailable <= 0;
        const active = String(room.id) === libId;
        return (
          <button
            key={room.id}
            type="button"
            onClick={() => !full && onChange(String(room.id))}
            disabled={full}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all border-slate-200 dark:border-transparent",
              active
                ? "border-blue-500/50 bg-blue-500/10"
                : full
                  ? "cursor-not-allowed border-slate-200 bg-slate-100/50 opacity-60 dark:border-transparent dark:bg-white/[0.04]"
                  : "border-slate-200 bg-slate-100 hover:bg-slate-200/70 dark:border-transparent dark:bg-white/[0.05] dark:hover:bg-white/[0.09]",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">{room.name}</span>
              <span className="block text-[11px] text-slate-500">{full ? "已满 · 可加入捡漏监控" : "实时余位"}</span>
            </span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
              full ? "bg-red-400/15 text-red-300" : "bg-green-500/15 text-green-500 dark:text-green-300",
            )}>
              {full ? "满" : `${room.seatsAvailable} 空`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 座位选择：下拉 / 手动输入切换 */
export function SeatSelect({
  seats, loading, seatNumber, onSeatNumber, selectedSeatKey, onSelectSeatKey,
}: {
  seats: DynamicSeat[];
  loading: boolean;
  seatNumber: string;
  onSeatNumber: (seat: string) => void;
  selectedSeatKey: string;
  onSelectSeatKey: (key: string, name: string) => void;
}) {
  const manual = seats.length === 0;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-400">
        <Armchair className="h-3.5 w-3.5" />座位号
        {seats.length > 0 && (
          <span className="text-[10px] font-normal text-green-500">（{seats.length} 可选）</span>
        )}
        {!manual && (
          <button
            type="button"
            className="ml-auto flex cursor-pointer items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600"
            onClick={() => {
              // 切到手动：保留下拉已选的座位号
              if (selectedSeatKey) {
                const seat = seats.find((s) => s.key === selectedSeatKey);
                if (seat) onSeatNumber(seat.name);
              }
              onSelectSeatKey("", seatNumber);
            }}
          >
            <Pencil className="h-3 w-3" />手动输入
          </button>
        )}
      </label>
      {manual ? (
        <Input
          placeholder="001"
          value={seatNumber}
          onChange={(e) => onSeatNumber(e.target.value)}
          autoComplete="off"
          className="h-10 text-center font-mono tracking-widest dark:border-white/15"
        />
      ) : (
        <div className="relative">
          <select
            aria-label="座位号"
            className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white/70 px-3 pr-9 font-mono text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-100"
            value={selectedSeatKey}
            disabled={loading}
            onChange={(e) => {
              const seat = seats.find((s) => s.key === e.target.value);
              onSelectSeatKey(e.target.value, seat?.name ?? "");
            }}
          >
            {loading ? (
              <option>加载中...</option>
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
          <Pointer className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      )}
    </div>
  );
}

/** 执行时间卡：立即 / 21:48 / 自定义（按页面取用不同选项） */
export function TimeCard({
  options, execTime, onExecTime, customTime, onCustomTime, hint,
}: {
  options: ExecTime[];
  execTime: ExecTime;
  onExecTime: (t: ExecTime) => void;
  customTime: string;
  onCustomTime: (t: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-400">
        <Clock className="h-3.5 w-3.5" />执行时间
        {hint && <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-normal text-amber-500 dark:text-amber-300">{hint}</span>}
      </div>
      <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
        {options.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onExecTime(t)}
            className={cn(
              "flex-1 cursor-pointer whitespace-nowrap rounded-lg px-2 py-2 text-xs transition-all",
              execTime === t
                ? "bg-white font-bold text-[#131a2a] shadow-sm dark:bg-white/90"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {t === "immediate" ? "立即执行" : t === "2148" ? "21:48" : "自定义"}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {execTime === "custom" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Input
              type="time"
              step="1"
              value={customTime}
              onChange={(e) => onCustomTime(e.target.value)}
              aria-label="自定义执行时间"
              className="text-center font-mono dark:border-white/15"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
