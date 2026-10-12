import { useEffect, useState } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { nextTargetTs } from "@/features/booking/model/useMsCountdown";

const EVENT_WINDOW = 10_000;
const NEAR_WINDOW = 60 * 60 * 1000;

/**
 * 灵动岛可见性（规范事件驱动）：任务运行中 ‖ 已就绪且距执行 < 1 小时 ‖ 结果事件未消隐。
 * tickMs 控制可见性检查的刷新频率。
 */
export function useIslandVisible(tickMs = 1000): boolean {
  const bookingRunning = useRuntimeStore((s) => s.bookingRunning);
  const scanning = useRuntimeStore((s) => s.scanning);
  const renewing = useRuntimeStore((s) => s.renewing);
  const lastEvent = useRuntimeStore((s) => s.lastEvent);
  const booking = useSettingsStore((s) => s.booking);
  const defaultTime = useSettingsStore((s) => s.prefs.defaultExecTime);
  const cookieStatus = useAuthStore((s) => s.cookieStatus);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const readyish = cookieStatus === "valid" && Boolean(booking.libId) && Boolean(booking.seatNumber);
  const targetTs = readyish ? nextTargetTs(booking.tomorrowExecTime, booking.customTime, defaultTime) : null;
  const nearTarget = targetTs !== null && targetTs - now < NEAR_WINDOW;
  const eventFresh = lastEvent !== null && now - lastEvent.at < EVENT_WINDOW;
  // dev 调试：?island=1 强制浮现（生产构建剔除）
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("island")) return true;
  return bookingRunning || scanning || renewing || nearTarget || eventFresh;
}
