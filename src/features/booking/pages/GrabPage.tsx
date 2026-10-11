import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Armchair, Building2, Timer, Zap } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { CardHead } from "@/components/glass/CardHead";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { notifyBookingSuccess } from "@/stores/scanner";
import { useRooms } from "../model/useRooms";
import { useSeats } from "../model/useSeats";
import { useBookingTask } from "../model/useBookingTask";
import { useMsCountdown, execTargetTime } from "../model/useMsCountdown";
import { useReservation } from "../model/useReservation";
import { ReservationCard } from "../components/ReservationCard";
import { VenueList, SeatSelect, TimeCard } from "../components/SelectionCards";
import { BackupChainPanel } from "@/features/seats/components/BackupChainPanel";
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
  // 抢座页把「默认时间」档视为立即执行
  const effectiveExec = booking.execTime === "2148" ? "immediate" : booking.execTime;
  const timed = effectiveExec === "custom" && Boolean(booking.customTime);
  const targetTime = execTargetTime(effectiveExec, booking.customTime, "21:48");
  const msCountdown = useMsCountdown(effectiveExec, booking.customTime, "21:48");
  const cookieReady = Boolean(booking.cookieStr && booking.cookieStr.trim().length >= 10);
  const teeth = [
    { label: "身份", ok: cookieReady, to: "/app/home" },
    { label: "场馆", ok: Boolean(booking.libId), to: "/app/grab" },
    { label: "座位", ok: Boolean(booking.seatNumber), to: "/app/grab" },
    { label: "时间", ok: effectiveExec !== "custom" || Boolean(booking.customTime), to: "/app/grab" },
  ];
  const missing = teeth.filter((t) => !t.ok).map((t) => t.label);

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

      {/* 执行 hero */}
      <GlassCard className="hero rise p-5 md:p-7">
        <div className="trigger-label">
          <span className="t">执行方式</span>
          <span className="mode">{timed ? `定时 ${booking.customTime}` : "立即"}</span>
        </div>
        <div className="bigtime">
          <span className="shimmer text-[34px] md:text-[44px]">{timed ? targetTime : "立即"}</span>
          <span className="cap">{timed ? "到点自动提交" : "选好座位后自动提交"}</span>
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
                className={cn("tooth", !t.ok && "miss")}
                onClick={() => navigate(t.to)}
              >
                <i />{t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-[var(--line2)] pt-5">
          <button
            type="button"
            className="btn grad big flex-1 sm:flex-none"
            disabled={!startEnabled || running}
            onClick={() => setShowConfirm(true)}
          >
            <Zap className="h-4 w-4" />{running ? "任务运行中" : "立即抢座"}
          </button>
          {missing.length > 0 && (
            <span className="text-[11px] font-semibold text-warn-ink dark:text-[#fcd34d]">
              还差 {missing.length} 项：{missing.join(" / ")}
            </span>
          )}
        </div>
      </GlassCard>

      <div className="grid items-start gap-4 md:grid-cols-2">
        {/* 场馆实时列表 + 执行时间 */}
        <div className="flex flex-col gap-4">
          <GlassCard className="rise p-4 md:p-5">
            <CardHead
              icon={Building2}
              title="阅览室"
              hint={dynamicRooms.length > 0 ? <span className="pill ok h-[18px] px-1.5 text-[9.5px]"><span className="dot" />实时</span> : undefined}
            />
            <div className="mt-3">
              <VenueList
                rooms={dynamicRooms}
                loading={loadingRooms}
                error={roomsError}
                libId={booking.libId}
                onChange={(libId) => { setBooking({ libId }); setSelectedSeatKey(""); }}
                cookieStr={booking.cookieStr}
              />
            </div>
          </GlassCard>
          <GlassCard className="rise p-4 md:p-5">
            <TimeCard
              options={["immediate", "custom"]}
              execTime={effectiveExec}
              onExecTime={(execTime) => setBooking({ execTime })}
              customTime={booking.customTime}
              onCustomTime={(customTime) => setBooking({ customTime })}
              hint="可改为定时提交"
            />
          </GlassCard>
        </div>

        {/* 座位 + 备选链 */}
        <div className="flex flex-col gap-4">
          <GlassCard className="rise p-4 md:p-5">
            <CardHead icon={Armchair} title="座位" />
            <div className="mt-3">
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
            </div>
          </GlassCard>
          <BackupChainPanel libId={booking.libId} />
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
