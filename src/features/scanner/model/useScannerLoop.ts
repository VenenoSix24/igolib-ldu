import { useCallback, useEffect, useRef, useState } from "react";
import { getDynamicRooms, getRoomSeats, submitRequest, buildBookingCandidates, type DynamicRoom } from "@/services/api";
import { useSettingsStore } from "@/stores/settings";
import { useScannerStore, registerScannerLoopStopper, type ScannerVenue } from "@/stores/scanner";
import { useBackupSeatsStore } from "@/stores/backupSeats";
import { useAuthStore, cookieBlocked } from "@/stores/auth";
import { notify } from "@/lib/notify";
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
  const cookieStatus = useAuthStore((s) => s.cookieStatus);

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
  const bookingRef = useRef(false);

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

  const stop = useCallback(() => {
    stoppedRef.current = true;
    clearTimer();
    setRunning(false);
    setCurrentLibId("");
    log.info("扫描已停止");
  }, []);

  /** 命中处理：拉取座位，优先该场馆备选链，自动预约 + 通知；返回是否预约成功 */
  const attemptBooking = useCallback(
    async (venue: ScannerVenue, room: DynamicRoom): Promise<boolean> => {
      if (bookingRef.current) return false;
      bookingRef.current = true;
      log.info(`${room.name} 出现空位（余 ${room.seatsAvailable}），尝试自动预约…`);
      try {
        const layout = await getRoomSeats(parseInt(venue.libId), cookieStr.trim(), apiConfig, 2);
        const available = layout.seats.filter((s) => s.available);
        if (available.length === 0) {
          log.info(`${room.name} 空位已被抢完，继续扫描`);
          return false;
        }

        // 备选链命中的座位优先（按链内顺序），其余空闲座位按序补位
        const chain = useBackupSeatsStore.getState().chains[venue.libId] ?? [];
        const candidates = buildBookingCandidates(layout.seats, chain);

        const target = candidates[0];
        await submitRequest(
          {
            clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            libId: parseInt(venue.libId),
            seatNumber: target.name,
            seatKey: target.key,
            mode: 2,
            timeStr: "",
            cookieStr: cookieStr.trim(),
            backupSeats: candidates.slice(1).map((s) => ({ key: s.key, name: s.name })),
            apiUrl: apiConfig.apiUrl,
            origin: apiConfig.origin,
            referer: apiConfig.referer,
          },
          (message) => log.info(message),
        );

        log.info(`${room.name} ${target.name} 号自动预约成功`);
        pushHit({
          libId: venue.libId,
          libName: room.name,
          seatName: target.name,
          message: "自动预约成功",
          kind: "booked",
        });
        notify("捡漏成功", `${room.name} ${target.name} 号已自动预约`);
        stop();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error(`${room.name} 自动预约失败：${msg}`);
        pushHit({ libId: venue.libId, libName: room.name, message: `自动预约失败：${msg}`, kind: "failed" });
        notify("捡漏预约失败", `${room.name}：${msg}`);
        if (msg.includes("Cookie无效")) {
          stop();
          setError("Cookie 已失效，扫描停止");
        }
        return false;
      } finally {
        bookingRef.current = false;
      }
    },
    [cookieStr, apiConfig, pushHit, stop],
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
          const booked = await attemptBooking(venue, room);
          if (stoppedRef.current) return;
          if (!booked) {
            // 预约失败后重置变化门槛，下一轮仍会尝试该场馆
            nextAvailable[venue.libId] = -1;
          }
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
  }, [cookieStr, apiConfig, interval, pushHit, schedule, attemptBooking]);

  const start = useCallback(() => {
    if (running) return;
    if (cookieBlocked(useAuthStore.getState().cookieStatus)) {
      setError("Cookie 已失效，请回首页重新扫码后再开启扫描");
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
  }, [running, interval, runRound]);

  // 抢座任务成功后自动停止同场馆扫描（防重复预约触发风控）
  useEffect(() => {
    if (!running) return;
    registerScannerLoopStopper((libId) => {
      if (venuesRef.current.some((v) => v.libId === libId)) {
        log.info("抢座任务成功，自动停止同场馆扫描");
        stop();
        setError("同场馆抢座任务已成功，扫描自动停止");
      }
    });
    return () => registerScannerLoopStopper(null);
  }, [running, stop]);

  // Cookie 被清空或被首页判失效时直接停扫
  useEffect(() => {
    if (running && (!cookieStr || cookieStr.trim().length < 10)) {
      stop();
      setError("Cookie 已失效，扫描停止");
    }
  }, [cookieStr, running, stop]);

  useEffect(() => {
    if (running && cookieBlocked(useAuthStore.getState().cookieStatus)) {
      stop();
      setError("Cookie 已失效，扫描停止");
    }
  }, [cookieStatus, running, stop]);

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
