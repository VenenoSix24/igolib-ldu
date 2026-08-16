import { useState } from "react";
import { Rocket, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass/GlassCard";
import { SlidingTabs } from "@/components/glass/SlidingTabs";
import { SettingsModal } from "@/components/SettingsModal";
import { useSettingsStore } from "@/stores/settings";
import { useBookingForm } from "../model/useBookingForm";
import { useRooms } from "../model/useRooms";
import { useSeats } from "../model/useSeats";
import { useBookingTask } from "../model/useBookingTask";
import { useCountdown } from "../model/useCountdown";
import { CookieField } from "../components/CookieField";
import { ModeTimeSection } from "../components/ModeTimeSection";
import { RoomSeatSection } from "../components/RoomSeatSection";
import { TaskConsole } from "../components/TaskConsole";
import { AuthQrDialog } from "../components/AuthQrDialog";
import { ConfirmDialog, ResultDialog } from "../components/BookingDialogs";

export function BookingPage() {
  const form = useBookingForm();
  const apiConfig = useSettingsStore((s) => s.api);
  const setApi = useSettingsStore((s) => s.setApi);

  const { rooms, dynamicRooms, loadingRooms, roomsError, userInfo, validatingCookie } =
    useRooms(form.cookieStr, apiConfig, form.libId, form.setLibId);
  const { dynamicSeats, loadingSeats } = useSeats(form.cookieStr, apiConfig, form.libId, form.opMode);
  const task = useBookingTask();
  const countDownStr = useCountdown(form.execTime, form.customTime);

  const [activeTab, setActiveTab] = useState<"config" | "console">("config");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const running = task.status === "running" || task.status === "connecting";

  const handleStartRequest = () => {
    if (!form.libId || !form.seatNumber || !form.cookieStr) return;
    setShowConfirm(true);
  };

  const confirmAndLaunch = () => {
    setShowConfirm(false);
    setActiveTab("console");
    task.launch({
      apiConfig,
      libId: form.libId,
      seatNumber: form.seatNumber,
      cookieStr: form.cookieStr,
      opMode: form.opMode,
      execTime: form.execTime,
      customTime: form.customTime,
      selectedSeatKey: form.selectedSeatKey,
      roomName: rooms[form.libId],
    });
  };

  const configPanel = (
    <GlassCard className="flex flex-col gap-5 p-5 md:p-6">
      <ModeTimeSection
        opMode={form.opMode}
        setOpMode={form.setOpMode}
        execTime={form.execTime}
        setExecTime={form.setExecTime}
        customTime={form.customTime}
        setCustomTime={form.setCustomTime}
      />

      <CookieField
        cookieStr={form.cookieStr}
        onChange={form.setCookieStr}
        validating={validatingCookie}
        userInfo={userInfo}
        onOpenAuth={() => setShowAuthDialog(true)}
      />

      <RoomSeatSection
        dynamicRooms={dynamicRooms}
        loadingRooms={loadingRooms}
        roomsError={roomsError}
        libId={form.libId}
        setLibId={form.setLibId}
        cookieStr={form.cookieStr}
        dynamicSeats={dynamicSeats}
        loadingSeats={loadingSeats}
        seatNumber={form.seatNumber}
        setSeatNumber={form.setSeatNumber}
        selectedSeatKey={form.selectedSeatKey}
        setSelectedSeatKey={form.setSelectedSeatKey}
        seatInputMode={form.seatInputMode}
        setSeatInputMode={form.setSeatInputMode}
      />

      <div className="flex gap-2 pt-1">
        {running ? (
          <Button
            variant="destructive"
            onClick={task.stop}
            className="flex-1 h-12 text-base font-bold rounded-xl shadow-lg shadow-red-500/20"
          >
            终止任务
          </Button>
        ) : (
          <Button
            className="flex-1 h-12 text-base font-bold rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleStartRequest}
            disabled={loadingRooms}
          >
            <Rocket className="w-5 h-5 mr-2" />
            启动任务
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="h-12 w-12 rounded-xl"
          title="API 设置"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </GlassCard>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 移动端：配置/控制台切换 */}
      <div className="md:hidden">
        <SlidingTabs
          className="glass rounded-full p-1"
          layoutId="booking-mobile-tabs"
          aria-label="预约页视图切换"
          items={[
            { value: "config", label: "配置" },
            { value: "console", label: "状态" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={activeTab === "config" ? "block" : "hidden md:block"}>
          {configPanel}
        </div>
        <div className={activeTab === "console" ? "block" : "hidden md:block"}>
          <TaskConsole
            status={task.status}
            currentPhase={task.currentPhase}
            latestLog={task.latestLog}
            logs={task.logs}
            setLogs={task.setLogs}
            countDownStr={countDownStr}
            onStop={task.stop}
          />
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={confirmAndLaunch}
        opMode={form.opMode}
        execTime={form.execTime}
        customTime={form.customTime}
        roomName={rooms[form.libId]}
        seatNumber={form.seatNumber}
      />

      <ResultDialog
        open={task.showResultDialog}
        onOpenChange={task.setShowResultDialog}
        status={task.status}
        latestLog={task.latestLog}
        roomName={rooms[form.libId]}
        seatNumber={form.seatNumber}
      />

      <AuthQrDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        apiConfig={apiConfig}
        onCookie={(cookie) => form.setCookieStr(cookie)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={apiConfig}
        onSave={(config) => setApi(config)}
      />
    </div>
  );
}
