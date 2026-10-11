import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useRuntimeStore } from "@/stores/runtime";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { execModeLabel, nextTargetTs } from "@/features/booking/model/useMsCountdown";

const EVENT_WINDOW = 10_000;
const NEAR_WINDOW = 60 * 60 * 1000;

const pad2 = (n: number) => String(n).padStart(2, "0");

function countdownText(targetTs: number | null, now: number): string {
  if (targetTs === null) return "--:--:--.--";
  const ms = Math.max(0, targetTs - now);
  return `${pad2(Math.floor(ms / 3600000))}:${pad2(Math.floor((ms % 3600000) / 60000))}:${pad2(Math.floor((ms % 60000) / 1000))}.${pad2(Math.floor((ms % 1000) / 10))}`;
}

/**
 * 灵动岛可见性（规范 §1-2 事件驱动）：任务运行中 ‖ 已就绪且距执行 < 1 小时 ‖ 结果事件未消隐。
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
  const targetTs = readyish ? nextTargetTs(booking.execTime, booking.customTime, defaultTime) : null;
  const nearTarget = targetTs !== null && targetTs - now < NEAR_WINDOW;
  const eventFresh = lastEvent !== null && now - lastEvent.at < EVENT_WINDOW;
  return bookingRunning || scanning || renewing || nearTarget || eventFresh;
}

/** 全局任务灵动岛：顶部黑色胶囊 + 展开浮窗 */
export function TaskIsland() {
  const navigate = useNavigate();
  const bookingRunning = useRuntimeStore((s) => s.bookingRunning);
  const scanning = useRuntimeStore((s) => s.scanning);
  const renewing = useRuntimeStore((s) => s.renewing);
  const context = useRuntimeStore((s) => s.context);
  const lastEvent = useRuntimeStore((s) => s.lastEvent);
  const booking = useSettingsStore((s) => s.booking);
  const defaultTime = useSettingsStore((s) => s.prefs.defaultExecTime);
  const cookieStatus = useAuthStore((s) => s.cookieStatus);

  const visible = useIslandVisible(70);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 70);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.(".isle, .isle-pop")) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const readyish = cookieStatus === "valid" && Boolean(booking.libId) && Boolean(booking.seatNumber);
  const targetTs = readyish ? nextTargetTs(booking.execTime, booking.customTime, defaultTime) : null;
  const eventFresh = lastEvent !== null && now - lastEvent.at < EVENT_WINDOW;
  const busy = bookingRunning || scanning || renewing;
  const modeLabel = execModeLabel(booking.execTime, booking.customTime, defaultTime);
  const ctxText = eventFresh && lastEvent ? lastEvent.text : context || "未设定目标";

  return createPortal(
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="全局任务状态"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}
        className={cn("isle", !visible && "out")}
      >
        <span className={cn("live", eventFresh && lastEvent?.kind === "error" && "err")} />
        <span className="il-txt">{ctxText}</span>
        <span className="vsep" />
        <span className="il-timer">
          <Timer className="h-3.5 w-3.5" />
          <b>{countdownText(targetTs, now)}</b>
        </span>
        <span className="vsep" />
        <span className={cn("eq", !busy && "idle")}><i /><i /><i /></span>
      </div>

      <div className={cn("isle-pop", open && "open")} onClick={(e) => e.stopPropagation()}>
        <h4 className="flex items-center gap-2 text-[13px] font-bold">
          {busy ? "任务运行中" : "下一次自动执行"}
        </h4>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="pill pri"><span className="dot" />{context || "未设定目标"}</span>
          <span className="pill ok"><span className="dot" />{modeLabel}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn grad sm" onClick={() => { setOpen(false); navigate("/app/tomorrow"); }}>
            去预约
          </button>
          <button type="button" className="btn ghost sm" onClick={() => { setOpen(false); navigate("/app/grab"); }}>
            立即抢座
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
