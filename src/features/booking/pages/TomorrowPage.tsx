import { useEffect, useState } from "react";
import { Armchair, Building2, Play, Timer } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useSettingsStore } from "@/stores/settings";
import { notifyBookingSuccess } from "@/stores/scanner";
import { useRooms } from "../model/useRooms";
import { useSeats } from "../model/useSeats";
import { useBookingTask } from "../model/useBookingTask";
import { useCountdown } from "../model/useCountdown";
import { useMsCountdown, execModeLabel, execTargetTime } from "../model/useMsCountdown";
import { useReservation } from "../model/useReservation";
import { ReservationCard } from "../components/ReservationCard";
import { VenueSelect, SeatSelect, TimeCard } from "../components/SelectionCards";
import { BackupChainPanel } from "@/features/seats/components/BackupChainPanel";
import { useBackupSeatsStore } from "@/stores/backupSeats";
import { ConsoleCard } from "../components/ConsoleCard";
import { ConfirmDialog, ResultDialog } from "../components/BookingDialogs";

export function TomorrowPage() {
  const apiConfig = useSettingsStore((s) => s.api);
  const booking = useSettingsStore((s) => s.booking);
  const setBooking = useSettingsStore((s) => s.setBooking);
  const defaultTime = useSettingsStore((s) => s.prefs.defaultExecTime);
  const setPrefs = useSettingsStore((s) => s.setPrefs);

  const { rooms, dynamicRooms, loadingRooms, roomsError } =
    useRooms(booking.cookieStr, apiConfig, booking.libId, (libId) => setBooking({ libId }));
  const { dynamicSeats, loadingSeats } = useSeats(booking.cookieStr, apiConfig, booking.libId, "scheduled");
  const task = useBookingTask();
  const countDownStr = useCountdown(booking.execTime, booking.customTime, defaultTime);
  const msCountdown = useMsCountdown(booking.execTime, booking.customTime, defaultTime);
  const modeLabel = execModeLabel(booking.execTime, booking.customTime, defaultTime);
  const targetTime = execTargetTime(booking.execTime, booking.customTime, defaultTime);
  const scheduled = booking.execTime !== "immediate";
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
  const missing = [
    !booking.cookieStr && "身份",
    !booking.libId && "场馆",
    !booking.seatNumber && "座位",
    booking.execTime === "custom" && !booking.customTime && "时间",
  ].filter(Boolean) as string[];

  const launch = () => {
    setShowConfirm(false);
    setBooking({ opMode: "scheduled" });
    task.launch({
      apiConfig,
      libId: booking.libId,
      seatNumber: booking.seatNumber,
      cookieStr: booking.cookieStr,
      opMode: "scheduled",
      execTime: booking.execTime,
      customTime: booking.customTime,
      defaultTime,
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

      {/* 执行 hero */}
      <GlassCard className="hero rise p-5 md:p-7">
        <div className="trigger-label">
          <span className="t">计划执行</span>
          <span className="mode">{modeLabel}</span>
        </div>
        <div className="bigtime">
          <span className="shimmer text-[34px] md:text-[44px]">{scheduled ? targetTime : "立即"}</span>
          <span className="cap">{scheduled ? "准时自动提交" : "启动后立即提交"}</span>
        </div>
        <div className="sub-row">
          {scheduled && (
            <span className="cd-pill"><Timer className="h-3.5 w-3.5" />倒计时<b>{msCountdown}</b></span>
          )}
          <span className="pill slate"><Building2 className="h-3 w-3" />{roomName || "未选场馆"}</span>
          <span className="pill slate"><Armchair className="h-3 w-3" />{booking.seatNumber ? `${booking.seatNumber} 号` : "未选座位"}</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-[var(--line2)] pt-5">
          <button
            type="button"
            className="btn grad big"
            disabled={!startEnabled || running || loadingRooms}
            onClick={() => setShowConfirm(true)}
          >
            <Play className="h-4 w-4" />{running ? "任务运行中" : "启动预约"}
          </button>
          {missing.length > 0 && (
            <span className="text-[11px] font-semibold text-warn-ink dark:text-[#fcd34d]">
              还差 {missing.length} 项：{missing.join(" / ")}
            </span>
          )}
        </div>
      </GlassCard>

      {/* 目标座位 / 执行时间 双列 */}
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="rise p-4 md:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold"><Building2 className="h-4 w-4" />目标座位</h3>
          <div className="flex flex-col gap-3.5">
            <VenueSelect
              rooms={dynamicRooms}
              loading={loadingRooms}
              error={roomsError}
              libId={booking.libId}
              onChange={(libId) => { setBooking({ libId }); setSelectedSeatKey(""); }}
              cookieStr={booking.cookieStr}
            />
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
            <BackupChainPanel libId={booking.libId} />
          </div>
        </GlassCard>
        <GlassCard className="rise p-4 md:p-5">
          <TimeCard
            options={["immediate", "2148", "custom"]}
            execTime={booking.execTime}
            onExecTime={(execTime) => setBooking({ execTime })}
            customTime={booking.customTime}
            onCustomTime={(customTime) => setBooking({ customTime })}
            hint={`模式默认 ${defaultTime}`}
            defaultTime={defaultTime}
            onDefaultTime={(t) => setPrefs({ defaultExecTime: t })}
          />
        </GlassCard>
      </div>

      <ConsoleCard
        status={task.status}
        currentPhase={task.currentPhase}
        latestLog={task.latestLog}
        logs={task.logs}
        setLogs={task.setLogs}
        countDownStr={countDownStr}
        onStop={task.stop}
      />

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={launch}
        opMode="scheduled"
        execTime={booking.execTime}
        customTime={booking.customTime}
        defaultTime={defaultTime}
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
