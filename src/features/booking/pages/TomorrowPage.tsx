import { useEffect, useState } from "react";
import { Armchair, Building2, Play } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useSettingsStore } from "@/stores/settings";
import { notifyBookingSuccess } from "@/stores/scanner";
import { useRooms } from "../model/useRooms";
import { useSeats } from "../model/useSeats";
import { useBookingTask } from "../model/useBookingTask";
import { useCountdown } from "../model/useCountdown";
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

  const { rooms, dynamicRooms, loadingRooms, roomsError, userInfo } =
    useRooms(booking.cookieStr, apiConfig, booking.libId, (libId) => setBooking({ libId }));
  const { dynamicSeats, loadingSeats } = useSeats(booking.cookieStr, apiConfig, booking.libId, "scheduled");
  const task = useBookingTask();
  const countDownStr = useCountdown(booking.execTime, booking.customTime, defaultTime);
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

      {/* 任务总览 */}
      <GlassCard className="p-4 md:p-5">
        <div className="flex flex-col items-center gap-3 md:flex-row md:gap-5">
          <div className="text-center md:text-left">
            <div className="bg-gradient-to-b from-slate-700 to-slate-900 bg-clip-text text-[34px] font-extrabold tracking-widest tabular-nums text-transparent md:text-[38px] dark:from-white dark:to-[#aebadc]">
              {countDownStr ?? "--:--:--"}
            </div>
            <div className="mt-0.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-300">
              距 {booking.execTime === "2148" ? defaultTime : booking.execTime === "custom" ? booking.customTime : "立即"} 自动执行
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[11.5px] text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              <Building2 className="h-3.5 w-3.5" />{roomName || "未选场馆"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[11.5px] text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              <Armchair className="h-3.5 w-3.5" />{booking.seatNumber ? `${booking.seatNumber} 号` : "未选座位"}
            </span>
            {userInfo?.valid && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-[11.5px] text-green-600 dark:text-green-300">
                ● 身份有效
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!startEnabled || running || loadingRooms}
            onClick={() => setShowConfirm(true)}
            className="flex cursor-pointer items-center gap-2 rounded-2xl md:ml-auto bg-gradient-to-br from-[#b3d0ff] to-[#7da7ff] px-6 py-3 text-[13.5px] font-extrabold text-[#10162a] shadow-[0_8px_24px_rgba(125,167,255,0.35)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />{running ? "任务运行中" : "启动预约"}
          </button>
        </div>
      </GlassCard>

      {/* 目标座位 / 执行时间 双列 */}
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-4 md:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-extrabold"><Building2 className="h-4 w-4" />目标座位</h3>
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
        <GlassCard className="p-4 md:p-5">
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
