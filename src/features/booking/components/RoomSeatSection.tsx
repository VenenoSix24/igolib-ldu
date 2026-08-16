import { Armchair, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DynamicRoom, DynamicSeat } from "@/services/api";

interface RoomSeatSectionProps {
  dynamicRooms: DynamicRoom[];
  loadingRooms: boolean;
  roomsError: string | null;
  libId: string;
  setLibId: (libId: string) => void;
  cookieStr: string;
  dynamicSeats: DynamicSeat[];
  loadingSeats: boolean;
  seatNumber: string;
  setSeatNumber: (seat: string) => void;
  selectedSeatKey: string;
  setSelectedSeatKey: (key: string) => void;
  seatInputMode: "manual" | "select";
  setSeatInputMode: (mode: "manual" | "select") => void;
}

export function RoomSeatSection({
  dynamicRooms, loadingRooms, roomsError, libId, setLibId, cookieStr,
  dynamicSeats, loadingSeats, seatNumber, setSeatNumber,
  selectedSeatKey, setSelectedSeatKey, seatInputMode, setSeatInputMode,
}: RoomSeatSectionProps) {
  return (
    <div className="flex flex-col gap-5 pt-4 border-t border-slate-100 dark:border-neutral-800">
      <div className="space-y-2">
        <Label className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2 dark:text-slate-400">
          <Building2 className="w-3 h-3" /> 阅览室
          {dynamicRooms.length > 0 && !roomsError && (
            <span className="text-green-500 text-[10px] font-normal">✓ 实时</span>
          )}
        </Label>
        <select
          className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 dark:bg-[rgb(16,16,16)] dark:border-neutral-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          value={libId}
          onChange={(e) => setLibId(e.target.value)}
          disabled={loadingRooms || dynamicRooms.length === 0}
        >
          {loadingRooms ? (
            <option>正在获取最新馆藏数据...</option>
          ) : dynamicRooms.length > 0 ? (
            [...dynamicRooms]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.seatsAvailable}座可用)
                </option>
              ))
          ) : (
            <option value="">{cookieStr ? "未找到可用场馆" : "请先输入有效 Cookie"}</option>
          )}
        </select>
        {roomsError && (
          <p className="text-xs text-amber-500">{roomsError}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2 dark:text-slate-400">
            <Armchair className="w-3 h-3" /> 座位号
            {dynamicSeats.length > 0 && !roomsError && (
              <span className="text-green-500 text-[10px] font-normal">({dynamicSeats.length}可用)</span>
            )}
          </Label>
          {dynamicSeats.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSeatInputMode(seatInputMode === "manual" ? "select" : "manual");
                // 切换模式时同步数据
                if (seatInputMode === "select" && selectedSeatKey) {
                  const seat = dynamicSeats.find(s => s.key === selectedSeatKey);
                  if (seat) setSeatNumber(seat.name);
                }
              }}
              className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
            >
              {seatInputMode === "manual" ? "选择座位 →" : "← 手动输入"}
            </button>
          )}
        </div>

        {seatInputMode === "manual" || dynamicSeats.length === 0 ? (
          <Input
            placeholder="001"
            value={seatNumber}
            onChange={(e) => setSeatNumber(e.target.value)}
            autoComplete="off"
            className="h-10 font-mono text-center tracking-widest dark:bg-[rgb(16,16,16)] dark:border-neutral-700"
          />
        ) : (
          <select
            className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 dark:bg-[rgb(16,16,16)] dark:border-neutral-700 dark:text-white font-mono"
            value={selectedSeatKey}
            onChange={(e) => {
              setSelectedSeatKey(e.target.value);
              // 同时更新 seatNumber
              const seat = dynamicSeats.find(s => s.key === e.target.value);
              if (seat) setSeatNumber(seat.name);
            }}
            disabled={loadingSeats}
          >
            {loadingSeats ? (
              <option>加载中...</option>
            ) : (
              <>
                <option value="">选择座位...</option>
                {[...dynamicSeats]
                  .sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh-CN", { numeric: true }))
                  .map((seat) => (
                    <option key={seat.key} value={seat.key}>
                      {seat.name}
                    </option>
                  ))}
              </>
            )}
          </select>
        )}
      </div>
    </div>
  );
}
