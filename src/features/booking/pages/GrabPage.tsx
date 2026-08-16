import { useEffect, useState } from "react";
import { Armchair, Building2, Zap } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useSettingsStore } from "@/stores/settings";
import { notifyBookingSuccess } from "@/stores/scanner";
import { useRooms } from "../model/useRooms";
import { useSeats } from "../model/useSeats";
import { useBookingTask } from "../model/useBookingTask";
import { useReservation } from "../model/useReservation";
import { ReservationCard } from "../components/ReservationCard";
import { VenueList, SeatSelect, TimeCard } from "../components/SelectionCards";
import { BackupChainPanel } from "@/features/seats/components/BackupChainPanel";
import { useBackupSeatsStore } from "@/stores/backupSeats";
import { ConsoleCard } from "../components/ConsoleCard";
import { ConfirmDialog, ResultDialog } from "../components/BookingDialogs";

export function GrabPage() {
  const apiConfig = useSettingsStore((s) => s.api);
  const booking = useSettingsStore((s) => s.booking);
  const setBooking = useSettingsStore((s) => s.setBooking);

  const { rooms, dynamicRooms, loadingRooms, roomsError } =
    useRooms(booking.cookieStr, apiConfig, booking.libId, (libId) => setBooking({ libId }));
  const { dynamicSeats, loadingSeats } = useSeats(booking.cookieStr, apiConfig, booking.libId, "immediate");
  const task = useBookingTask();
  const { reservation, loading: loadingReservation, refresh: refreshReservation } = useReservation(booking.cookieStr, apiConfig);

  // 抢座成功后刷新当前预约，并停止同场馆的捡漏扫描
  useEffect(() => {
    if (task.status === "success") {
      void refreshReservation();
      notifyBookingSuccess(booking.libId);
    }
  }, [task.status, refreshReservation, booking.libId]);

  const [selectedSeatKey, setSelectedSeatKey] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const roomName = rooms[booking.libId];
  const startEnabled = Boolean(booking.libId && booking.seatNumber && booking.cookieStr);
  const running = task.status === "running" || task.status === "connecting";

  const launch = () => {
    setShowConfirm(false);
    setBooking({ opMode: "immediate" });
    task.launch({
      apiConfig,
      libId: booking.libId,
      seatNumber: booking.seatNumber,
      cookieStr: booking.cookieStr,
      opMode: "immediate",
      execTime: booking.execTime,
      customTime: booking.customTime,
      backupSeats: useBackupSeatsStore.getState().chains[booking.libId] ?? [],
      selectedSeatKey,
      roomName,
    });
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

      {/* 行动卡 */}
      <GlassCard className="flex items-center gap-3 p-4 md:p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500 dark:text-amber-300">
          <Zap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold">今日实时抢座</div>
          <div className="text-[11.5px] text-slate-500 dark:text-slate-300">选好座位即刻出手</div>
        </div>
        <button
          type="button"
          disabled={!startEnabled || running}
          onClick={() => setShowConfirm(true)}
          className="flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-br from-[#b3d0ff] to-[#7da7ff] px-5 py-2.5 text-[12.5px] font-extrabold text-[#10162a] shadow-[0_8px_24px_rgba(125,167,255,0.35)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />{running ? "任务运行中" : "立即抢座"}
        </button>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 场馆实时列表 */}
        <GlassCard className="p-4 md:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-extrabold">
            <Building2 className="h-4 w-4" />阅览室
            <span className="ml-auto text-[10px] font-normal text-slate-400">实时</span>
          </h3>
          <VenueList
            rooms={dynamicRooms}
            loading={loadingRooms}
            error={roomsError}
            libId={booking.libId}
            onChange={(libId) => { setBooking({ libId }); setSelectedSeatKey(""); }}
            cookieStr={booking.cookieStr}
          />
        </GlassCard>

        {/* 座位 + 执行时间 */}
        <div className="flex flex-col gap-4">
          <GlassCard className="p-4 md:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-extrabold"><Armchair className="h-4 w-4" />座位</h3>
            <SeatSelect
              seats={dynamicSeats}
              loading={loadingSeats}
              seatNumber={booking.seatNumber}
              onSeatNumber={(seatNumber) => setBooking({ seatNumber })}
              selectedSeatKey={selectedSeatKey}
              onSelectSeatKey={(key, name) => {
                setSelectedSeatKey(key);
                if (name) setBooking({ seatNumber: name });
              }}
              libId={booking.libId}
            />
            <div className="mt-3">
              <BackupChainPanel libId={booking.libId} />
            </div>
          </GlassCard>
          <GlassCard className="p-4 md:p-5">
            <TimeCard
              options={["immediate", "custom"]}
              execTime={booking.execTime === "2148" ? "immediate" : booking.execTime}
              onExecTime={(execTime) => setBooking({ execTime })}
              customTime={booking.customTime}
              onCustomTime={(customTime) => setBooking({ customTime })}
              hint="支持定时出手"
            />
          </GlassCard>
        </div>
      </div>

      <ConsoleCard
        status={task.status}
        currentPhase={task.currentPhase}
        latestLog={task.latestLog}
        logs={task.logs}
        setLogs={task.setLogs}
        onStop={task.stop}
      />

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={launch}
        opMode="immediate"
        execTime={booking.execTime === "2148" ? "immediate" : booking.execTime}
        customTime={booking.customTime}
        roomName={roomName}
        seatNumber={booking.seatNumber}
      />
      <ResultDialog
        open={task.showResultDialog}
        onOpenChange={task.setShowResultDialog}
        status={task.status}
        latestLog={task.latestLog}
        roomName={roomName}
        seatNumber={booking.seatNumber}
      />
    </div>
  );
}
