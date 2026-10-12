import { useEffect, useRef, useState } from "react";
import { ArrowUp, Building2, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { CardHead } from "@/components/glass/CardHead";
import { getRoomSeats } from "@/services/api";
import type { ApiConfig } from "@/lib/api-config";
import type { DynamicRoom, DynamicSeat } from "@/services/api";
import { useBackupSeatsStore, EMPTY_BACKUP_CHAIN } from "@/stores/backupSeats";

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

interface SeatPriorityCardProps {
  cookieStr: string;
  apiConfig: ApiConfig;
  rooms: DynamicRoom[];
  loadingRooms: boolean;
  roomsError: string | null;
  libId: string;
  onLibId: (libId: string) => void;
  /** scheduled = 明日（全量座位），immediate = 抢座（仅空闲） */
  opMode: "scheduled" | "immediate";
  seatNumber: string;
  selectedSeatKey: string;
  onPick: (key: string, name: string) => void;
}

/**
 * 目标座位卡：主选 + 顺位备选一个列表讲完「按序抢座」，四方卡网格呈现。
 * 场馆选择在工具行；空闲座位号云懒加载点选加入；无真实座位坐标，网格组件已退役。
 */
export function SeatPriorityCard({
  cookieStr, apiConfig, rooms, loadingRooms, roomsError, libId, onLibId, opMode, seatNumber, selectedSeatKey, onPick,
}: SeatPriorityCardProps) {
  const chain = useBackupSeatsStore((s) => s.chains[libId] ?? EMPTY_BACKUP_CHAIN);

  const [input, setInput] = useState("");
  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudSeats, setCloudSeats] = useState<DynamicSeat[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const cloudLoadedForRef = useRef<string>("");

  const selectedRoom = rooms.find((r) => String(r.id) === libId);
  const inList = (name: string) => seatNumber === name || chain.some((b) => b.name === name);

  /** 加入顺位：主选为空则成为主选，否则追加为备选 */
  const addSeat = (name: string, key: string) => {
    if (!name || inList(name)) return;
    if (!seatNumber) {
      onPick(key, name);
    } else {
      useBackupSeatsStore.getState().toggle(libId, { key: key || name, name });
    }
  };

  /** 右键号码：跳过主选，直接插到备选链首 */
  const addAsBackup = (seat: DynamicSeat) => {
    if (inList(seat.name)) return;
    useBackupSeatsStore.getState().unshift(libId, { key: seat.key || seat.name, name: seat.name });
  };

  /** 主选移除后备选① 递补 */
  const removePrimary = () => {
    const first = chain[0];
    useBackupSeatsStore.getState().remove(libId, first?.key ?? "");
    onPick(first?.key ?? "", first?.name ?? "");
  };

  /** 备选① 上移即升为主选，原主选降为首备选 */
  const promoteFirstBackup = () => {
    const first = chain[0];
    if (!first) return;
    const store = useBackupSeatsStore.getState();
    store.remove(libId, first.key);
    if (seatNumber) store.unshift(libId, { key: selectedSeatKey || seatNumber, name: seatNumber });
    onPick(first.key, first.name);
  };

  const loadCloud = async () => {
    if (!libId || !cookieStr || cookieStr.trim().length < 10) {
      setCloudSeats([]);
      return;
    }
    setCloudLoading(true);
    setCloudError(null);
    try {
      const mode = opMode === "scheduled" ? 1 : 2;
      const data = await getRoomSeats(parseInt(libId), cookieStr.trim(), apiConfig, mode);
      setCloudSeats(data.seats.filter((s) => s.available));
      cloudLoadedForRef.current = libId;
    } catch (e) {
      setCloudSeats([]);
      setCloudError(e instanceof Error ? e.message : "座位数据拉取失败");
    } finally {
      setCloudLoading(false);
    }
  };

  const toggleCloud = () => {
    const next = !cloudOpen;
    setCloudOpen(next);
    if (next && cloudLoadedForRef.current !== libId) void loadCloud();
  };

  // 展开状态下切换场馆：重拉该场馆座位
  useEffect(() => {
    if (cloudOpen && cloudLoadedForRef.current !== libId) void loadCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libId, cloudOpen]);

  return (
    <GlassCard className="rise p-4 md:p-5">
      {/* 卡头：标题 + 选座开关 */}
      <div className="flex items-center gap-3">
        <CardHead icon={Building2} title="目标座位" />
        <button type="button" className="btn ghost sm ml-auto" onClick={toggleCloud} disabled={!libId}>
          选座
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", cloudOpen && "rotate-180")} />
        </button>
      </div>

      {/* 工具行：实时余位 + 场馆选择 */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {opMode === "immediate" && selectedRoom && (
          <span className={cn(
            "pill h-[26px] px-2.5",
            !selectedRoom.isOpen ? "slate" : selectedRoom.seatsAvailable <= 0 ? "err" : "ok",
          )}>
            <span className="dot" />
            {!selectedRoom.isOpen ? "未开放" : `余 ${selectedRoom.seatsAvailable}`}
          </span>
        )}
        <div className="relative min-w-0 flex-1 sm:max-w-[300px]">
          <select
            aria-label="阅览室"
            className="select h-[34px] appearance-none pr-8 text-[12px]"
            value={libId}
            onChange={(e) => onLibId(e.target.value)}
            disabled={loadingRooms || rooms.length === 0}
          >
            {loadingRooms ? (
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
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
        </div>
      </div>
      {roomsError && (
        <p className="mt-2 text-[11.5px] text-warn-ink dark:text-[#fcd34d]">{roomsError}</p>
      )}

      {/* 顺位四方卡 */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {!seatNumber && chain.length === 0 ? (
          <div className="col-span-full rounded-[14px] border border-dashed border-[color-mix(in_srgb,var(--pri)_35%,transparent)] bg-[color-mix(in_srgb,var(--pri)_6%,transparent)] px-4 py-4 text-center text-[11.5px] text-sub">
            还没有目标座位：从空闲列表点选，或直接输入座位号加入
          </div>
        ) : (
          <>
            {seatNumber && (
              <div className="relative rounded-2xl border border-[color-mix(in_srgb,var(--pri)_40%,transparent)] bg-[color-mix(in_srgb,var(--pri)_10%,transparent)] p-3">
                <div className="flex items-center justify-between">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--pri)] text-[10px] font-extrabold text-[var(--pri-ink)]">①</span>
                  <button
                    type="button"
                    aria-label={`移除主选 ${seatNumber}`}
                    onClick={removePrimary}
                    className="cursor-pointer rounded-md p-0.5 text-sub transition-colors hover:bg-[rgba(244,63,94,0.1)] hover:text-err"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mono mt-1.5 text-[18px] font-extrabold leading-none text-pri-text dark:text-acc-hi">{seatNumber} 号</p>
                <p className="mt-1.5 text-[10.5px] font-semibold text-mut">主选 · 最先尝试</p>
              </div>
            )}
            {chain.map((b, i) => (
              <div
                key={b.key || b.name}
                className="relative rounded-2xl border border-[color-mix(in_srgb,var(--acc)_30%,transparent)] bg-[color-mix(in_srgb,var(--acc)_10%,transparent)] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--glass-3)] text-[10px] font-extrabold text-ink">
                    {CIRCLED[i + 1] ?? i + 2}
                  </span>
                  <span className="flex">
                    <button
                      type="button"
                      aria-label={`上移 ${b.name}`}
                      onClick={() => (i === 0 ? promoteFirstBackup() : useBackupSeatsStore.getState().move(libId, b.key, -1))}
                      className="cursor-pointer rounded-md p-0.5 text-sub transition-colors hover:bg-[var(--glass-3)] hover:text-ink"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`移除备选 ${b.name}`}
                      onClick={() => useBackupSeatsStore.getState().remove(libId, b.key)}
                      className="cursor-pointer rounded-md p-0.5 text-sub transition-colors hover:bg-[rgba(244,63,94,0.1)] hover:text-err"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                <p className="mono mt-1.5 text-[16px] font-bold leading-none text-pri-text dark:text-acc-hi">{b.name} 号</p>
                <p className="mt-1.5 text-[10.5px] text-sub">备选</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 添加行 */}
      <div className="mt-3 flex gap-2">
        <input
          placeholder="输入座位号，如 056"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              addSeat(input.trim(), input.trim());
              setInput("");
            }
          }}
          autoComplete="off"
          className="input mono h-[32px] w-full max-w-[200px] flex-1 text-center text-[12px] tracking-widest sm:flex-none"
        />
        <button
          type="button"
          className="btn grad sm shrink-0"
          disabled={!input.trim()}
          onClick={() => {
            addSeat(input.trim(), input.trim());
            setInput("");
          }}
        >
          + 加入
        </button>
      </div>

      {/* 空闲座位号云（懒加载） */}
      {cloudOpen && (
        <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--glass-2)] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-sub">
            空闲座位
            {cloudSeats.length > 0 && <span className="font-normal">共 {cloudSeats.length} 个</span>}
            <button
              type="button"
              aria-label="刷新空闲座位"
              onClick={() => void loadCloud()}
              className="ml-auto cursor-pointer rounded-md p-1 transition-colors hover:bg-[var(--glass-3)] hover:text-ink"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", cloudLoading && "animate-spin")} />
            </button>
          </div>
          {cloudLoading && cloudSeats.length === 0 ? (
            <p className="flex items-center justify-center gap-1.5 py-3 text-[11.5px] text-sub">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />正在拉取空闲座位…
            </p>
          ) : cloudError ? (
            <p className="py-2 text-center text-[11.5px] text-err-ink dark:text-[#fda4af]">{cloudError}，可直接输入座位号加入</p>
          ) : cloudSeats.length === 0 ? (
            <p className="py-2 text-center text-[11.5px] text-sub">
              暂无空闲座位数据（明日模式可能未开放），可直接输入座位号加入
            </p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {cloudSeats.map((s) => {
                const used = inList(s.name);
                return (
                  <button
                    key={s.key || s.name}
                    type="button"
                    disabled={used}
                    onClick={() => addSeat(s.name, s.key)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      addAsBackup(s);
                    }}
                    title={used ? "已在顺位中" : "点击加入顺位，右键仅加入备选"}
                    className={cn(
                      "mono h-7 min-w-[44px] rounded-lg border px-2 text-[11.5px] font-bold tabular-nums transition-all",
                      used
                        ? "cursor-default border-[var(--line2)] text-sub opacity-45"
                        : "cursor-pointer border-[var(--line)] bg-[var(--glass-3)] text-ink hover:border-[var(--pri)] hover:text-pri-text active:scale-95 dark:text-ink dark:hover:text-acc-hi",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[10.5px] text-sub">抢不到 ① 时，自动按顺位尝试后续座位；右键号码仅加入备选</p>
    </GlassCard>
  );
}
