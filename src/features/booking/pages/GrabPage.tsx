import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timer, Zap } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { notifyBookingSuccess } from "@/stores/scanner";
import { useRooms } from "../model/useRooms";
import { useBookingTask } from "../model/useBookingTask";
import { useMsCountdown, execTargetTime } from "../model/useMsCountdown";
import { useReservation } from "../model/useReservation";
import { ReservationCard } from "../components/ReservationCard";
import { ExecBar } from "../components/ExecBar";
import { SeatPriorityCard } from "../components/SeatPriorityCard";
import { useBackupSeatsStore } from "@/stores/backupSeats";
import { ConsoleCard } from "../components/ConsoleCard";
import { ConfirmDialog, ResultDialog } from "../components/BookingDialogs";

export function GrabPage() {
  const navigate = useNavigate();
  const apiConfig = useSettingsStore((s) => s.api);
  const booking = useSettingsStore((s) => s.booking);
  const setBooking = useSettingsStore((s) => s.setBooking);

  const { rooms, dynamicRooms, loadingRooms, roomsError } =
    useRooms(booking.cookieStr, apiConfig, booking.libId, (libId) => setBooking({ libId }));
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
  // 抢座页把「默认时间」档视作立即执行（历史数据兼容）
  const effectiveExec = booking.grabExecTime === "2148" ? "immediate" : booking.grabExecTime;
  const timed = effectiveExec === "custom" && Boolean(booking.customTime);
  const targetTime = execTargetTime(effectiveExec, booking.customTime, "21:48");
  const msCountdown = useMsCountdown(effectiveExec, booking.customTime, "21:48");
  const cookieReady = Boolean(booking.cookieStr && booking.cookieStr.trim().length >= 10);
  const teeth = [
    { label: "身份", st: cookieReady ? "ok" : "idle", to: "/app/home" },
    { label: "场馆", st: booking.libId ? "ok" : "idle", to: "/app/grab" },
    { label: "座位", st: booking.seatNumber ? "ok" : "idle", to: "/app/grab" },
    { label: "时间", st: effectiveExec !== "custom" || booking.customTime ? "ok" : "idle", to: "/app/grab" },
  ] as const;

  const launch = () => {
    setShowConfirm(false);
    setBooking({ opMode: "immediate" });
    task.launch({
      apiConfig,
      libId: booking.libId,
      seatNumber: booking.seatNumber,
      cookieStr: booking.cookieStr,
      opMode: "immediate",
      execTime: booking.grabExecTime,
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

      {/* 执行 hero */}
      <GlassCard className="hero rise p-5 md:p-7">
        <div className="md:flex md:items-center md:gap-8">
          <div className="hero-center min-w-0 flex-1">
            <div className="trigger-label">
              <span className="t">执行方式</span>
              <span className="mode">{timed ? `定时 ${booking.customTime}` : "立即"}</span>
            </div>
            <div className="bigtime">
              <span className="shimmer text-[34px] md:text-[44px]">{timed ? targetTime : "立即"}</span>
              <span className={cn("cap", timed && "hidden md:inline")}>{timed ? "到点自动提交" : "选好座位后自动提交"}</span>
            </div>
            <div className="sub-row">
              {timed && (
                <span className="cd-pill"><Timer className="h-3.5 w-3.5" />倒计时<b>{msCountdown}</b></span>
              )}
              <div className="teeth">
                {teeth.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className={cn("tooth", t.st === "ok" && "ok")}
                    onClick={() => navigate(t.to)}
                  >
                    <i />{t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 shrink-0 md:mt-0 md:w-[200px]">
            <button
              type="button"
              className="btn grad big w-full"
              disabled={!startEnabled || running}
              onClick={() => setShowConfirm(true)}
            >
              <Zap className="h-4 w-4" />{running ? "任务运行中" : "立即抢座"}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 执行档位 */}
      <ExecBar
        options={["immediate", "custom"]}
        execTime={effectiveExec}
        onExecTime={(grabExecTime) => setBooking({ grabExecTime })}
        customTime={booking.customTime}
        onCustomTime={(customTime) => setBooking({ customTime })}
      />

      {/* 目标座位：主选 + 顺位备选（含实时余位） */}
      <SeatPriorityCard
        cookieStr={booking.cookieStr}
        apiConfig={apiConfig}
        rooms={dynamicRooms}
        loadingRooms={loadingRooms}
        roomsError={roomsError}
        libId={booking.libId}
        onLibId={(libId) => setBooking({ libId })}
        opMode="immediate"
        seatNumber={booking.seatNumber}
        selectedSeatKey={selectedSeatKey}
        onPick={(key, name) => {
          setSelectedSeatKey(key);
          setBooking({ seatNumber: name });
        }}
      />

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
        execTime={effectiveExec}
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
