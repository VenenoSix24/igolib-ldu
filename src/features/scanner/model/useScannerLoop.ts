import { useCallback, useEffect, useRef, useState } from "react";
import { getDynamicRooms, type DynamicRoom } from "@/services/api";
import { useSettingsStore } from "@/stores/settings";
import { useScannerStore, type ScannerVenue } from "@/stores/scanner";
import { createLogger } from "@/lib/logger";

const log = createLogger("捡漏");

export interface VenueStatus {
  libId: string;
  name: string;
  /** 空位数；-1 表示本轮未取到（场馆不在返回列表） */
  available: number;
  isOpen: boolean;
}

/**
 * 捡漏扫描循环：按优先级轮询场馆余位。
 * 间隔下限 3 秒；连续网络失败按 2 的幂退避，上限 60 秒。
 */
export function useScannerLoop() {
  const apiConfig = useSettingsStore((s) => s.api);
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const scanIntervalSec = useSettingsStore((s) => s.prefs.scanIntervalSec);
  const venues = useScannerStore((s) => s.venues);
  const pushHit = useScannerStore((s) => s.pushHit);

  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [currentLibId, setCurrentLibId] = useState("");
  const [venueStatuses, setVenueStatuses] = useState<VenueStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const venuesRef = useRef<ScannerVenue[]>(venues);
  const lastAvailableRef = useRef<Record<string, number>>({});
  const consecutiveErrorsRef = useRef(0);

  useEffect(() => {
    venuesRef.current = venues;
  }, [venues]);

  const interval = Math.max(3, scanIntervalSec);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const schedule = useCallback(
    (delaySec: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        void runRound();
      }, delaySec * 1000);
    },
    // runRound 通过 ref 间接引用，保持 schedule 稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runRound = useCallback(async () => {
    if (stoppedRef.current) return;
    setRounds((r) => r + 1);

    try {
      const { rooms } = await getDynamicRooms(cookieStr.trim(), apiConfig);
      if (stoppedRef.current) return;

      consecutiveErrorsRef.current = 0;
      setError(null);

      const byId = new Map<string, DynamicRoom>(rooms.map((r) => [String(r.id), r]));
      const statuses: VenueStatus[] = [];
      const nextAvailable: Record<string, number> = {};

      for (const venue of venuesRef.current) {
        if (stoppedRef.current) return;
        setCurrentLibId(venue.libId);
        const room = byId.get(venue.libId);
        const available = room?.isOpen ? room.seatsAvailable : -1;
        statuses.push({
          libId: venue.libId,
          name: room?.name || venue.name,
          available: room ? available : -1,
          isOpen: room?.isOpen ?? false,
        });
        nextAvailable[venue.libId] = room ? available : -1;

        const previous = lastAvailableRef.current[venue.libId] ?? -1;
        if (room?.isOpen && room.seatsAvailable > 0 && previous <= 0) {
          log.info(`发现空位：${room.name} 余 ${room.seatsAvailable} 个`);
          pushHit({
            libId: venue.libId,
            libName: room.name,
            message: `发现空位，余 ${room.seatsAvailable} 个`,
            kind: "found",
          });
        }
      }

      lastAvailableRef.current = nextAvailable;
      setVenueStatuses(statuses);
      setCurrentLibId("");
      schedule(interval);
    } catch (e) {
      if (stoppedRef.current) return;
      consecutiveErrorsRef.current += 1;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      const backoff = Math.min(interval * 2 ** consecutiveErrorsRef.current, 60);
      log.warn(`第 ${consecutiveErrorsRef.current} 次连续失败：${msg}，${backoff}s 后重试`);
      schedule(backoff);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookieStr, apiConfig, interval, pushHit, schedule]);

  const start = useCallback(() => {
    if (running) return;
    if (!cookieStr || cookieStr.trim().length < 10) {
      setError("Cookie 无效，请先在首页完成扫码登录");
      return;
    }
    if (venuesRef.current.length === 0) {
      setError("请先勾选要监控的场馆");
      return;
    }
    stoppedRef.current = false;
    consecutiveErrorsRef.current = 0;
    lastAvailableRef.current = {};
    setError(null);
    setRunning(true);
    log.info(`扫描启动：${venuesRef.current.length} 个场馆，间隔 ${interval}s`);
    void runRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, cookieStr, interval, runRound]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    clearTimer();
    setRunning(false);
    setCurrentLibId("");
    log.info("扫描已停止");
  }, []);

  useEffect(() => {
    // Cookie 被清空时直接停扫
    if (running && (!cookieStr || cookieStr.trim().length < 10)) {
      stop();
      setError("Cookie 已失效，扫描停止");
    }
  }, [cookieStr, running, stop]);

  useEffect(() => () => {
    stoppedRef.current = true;
    clearTimer();
  }, []);

  return {
    running,
    rounds,
    currentLibId,
    venueStatuses,
    error,
    interval,
    start,
    stop,
  };
}
