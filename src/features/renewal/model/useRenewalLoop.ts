import { useCallback, useEffect, useRef, useState } from "react";
import {
  getReservation,
  getRoomSeats,
  getLibRule,
  cancelReservation,
  submitRequest,
  buildBookingCandidates,
} from "@/services/api";
import type { ReservationInfo, LibRuleInfo } from "@/services/LibraryService";
import { useSettingsStore } from "@/stores/settings";
import { useBackupSeatsStore } from "@/stores/backupSeats";
import { useAuthStore, cookieBlocked } from "@/stores/auth";
import { notify } from "@/lib/notify";
import { createLogger } from "@/lib/logger";

const log = createLogger("续约");

/** 连续失败达到该轮数自动停止并强提醒 */
const MAX_CONSECUTIVE_FAILURES = 3;

export type RenewalPhase = "idle" | "waiting" | "cancelling" | "cooldown" | "rebooking" | "stopped";

/** 服务端时间戳兼容秒 / 毫秒两种精度 */
function normalizeTs(raw?: number): number | null {
  if (!raw || raw <= 0) return null;
  return raw < 1e12 ? raw * 1000 : raw;
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * 占座续约循环：临近签到截止 → 取消 → 等待 N 秒 → 重订（原座位 → 备选链）→ 循环。
 * 下一轮触发优先取 renewTimeNext，否则按签到截止时间减提前量。
 * 连续失败 3 轮自动停止 + 强提醒；forbidWechatCancle 为真时拒绝启动 / 停止。
 */
export function useRenewalLoop() {
  const apiConfig = useSettingsStore((s) => s.api);
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const renewalDelaySec = useSettingsStore((s) => s.prefs.renewalDelaySec);
  const renewalLeadMinutes = useSettingsStore((s) => s.prefs.renewalLeadMinutes);
  const lduFallback = useSettingsStore((s) => s.prefs.lduFallbackEnabled);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<RenewalPhase>("idle");
  const [rounds, setRounds] = useState(0);
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const [nextActionAt, setNextActionAt] = useState<number | null>(null);
  const [nextActionLabel, setNextActionLabel] = useState("");
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("");
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const cookieStatus = useAuthStore((s) => s.cookieStatus);
  const [libRule, setLibRule] = useState<LibRuleInfo | null>(null);

  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delaySecRef = useRef(renewalDelaySec);
  const leadMinRef = useRef(renewalLeadMinutes);

  useEffect(() => {
    delaySecRef.current = renewalDelaySec;
    leadMinRef.current = renewalLeadMinutes;
  }, [renewalDelaySec, renewalLeadMinutes]);

  // 倒计时刷新
  useEffect(() => {
    if (!running) return;
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, [running]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /** 强提醒 + 自动停止（连续失败达到上限） */
  const abortWithAlert = useCallback((reason: string) => {
    notify("续约已自动停止", reason);
    notify("续约安全停止，请手动处理", `连续失败 ${MAX_CONSECUTIVE_FAILURES} 轮：${reason}`);
    log.error(`连续失败 ${MAX_CONSECUTIVE_FAILURES} 轮，自动停止：${reason}`);
    stoppedRef.current = true;
    clearTimer();
    setRunning(false);
    setPhase("stopped");
    setNextActionAt(null);
    setMessage(`已自动停止：连续失败 ${MAX_CONSECUTIVE_FAILURES} 轮（${reason}）`);
  }, []);

  const stop = useCallback((reason = "手动停止") => {
    stoppedRef.current = true;
    clearTimer();
    setRunning(false);
    setPhase("stopped");
    setNextActionAt(null);
    setMessage(reason);
    log.info(`续约停止：${reason}`);
  }, []);

  /** 计算下一轮触发时间：renewTimeNext 优先，否则签到截止 - 提前量 */
  const scheduleNextRound = useCallback(
    async (current: ReservationInfo | null) => {
      if (cookieBlocked(useAuthStore.getState().cookieStatus)) {
        stop("Cookie 已失效，续约停止");
        return;
      }
      const fresh = current ?? (await getReservation(cookieStr.trim(), apiConfig));
      if (stoppedRef.current) return;
      setReservation(fresh);

      if (!fresh || !fresh.seatName) {
        stop("当前无有效预约，续约结束");
        return;
      }

      const renewNext = normalizeTs(fresh.renewTimeNext);
      const validateTs = fresh.validateDate ? Date.parse(fresh.validateDate) : NaN;
      const leadMs = leadMinRef.current * 60 * 1000;
      const target = renewNext ?? (Number.isFinite(validateTs) ? validateTs - leadMs : null);

      if (target === null || target <= Date.now()) {
        // 无可解析的触发时间（数据缺失），立即开始下一轮
        void runRound(fresh);
        return;
      }
      setPhase("waiting");
      setNextActionAt(target);
      setNextActionLabel("下一轮续约");
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (!stoppedRef.current) void runRound(null);
      }, target - Date.now());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cookieStr, apiConfig, stop],
  );

  /** 重订：原座位 → 该场馆备选链 → 其余空闲 */
  const rebook = useCallback(
    async (current: ReservationInfo): Promise<boolean> => {
      const libId = current.libId;
      if (!libId) throw new Error("当前预约缺少场馆信息，无法重订");

      setPhase("rebooking");
      const layout = await getRoomSeats(libId, cookieStr.trim(), apiConfig, 2);
      const chain = useBackupSeatsStore.getState().chains[String(libId)] ?? [];
      const candidates = buildBookingCandidates(layout.seats, chain, current.seatKey);
      if (candidates.length === 0) throw new Error("场馆已无空闲座位");

      const target = candidates[0];
      await submitRequest(
        {
          clientId: `renewal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          libId,
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
        (msg) => log.info(msg),
      );
      log.info(`重订成功：${target.name} 号${target.key === current.seatKey ? "（原座位）" : "（换座）"}`);
      return true;
    },
    [cookieStr, apiConfig],
  );

  const runRound = useCallback(
    async (known: ReservationInfo | null) => {
      if (stoppedRef.current) return;
      if (cookieBlocked(useAuthStore.getState().cookieStatus)) {
        stop("Cookie 已失效，续约停止");
        return;
      }
      try {
        const current = known ?? (await getReservation(cookieStr.trim(), apiConfig));
        if (stoppedRef.current) return;
        setReservation(current);

        if (!current || !current.seatName) {
          stop("当前无有效预约，续约结束");
          return;
        }
        if (current.forbidWechatCancle) {
          abortWithAlert("当前预约被标记为禁止取消（forbidWechatCancle）");
          return;
        }
        if (!current.sToken) {
          abortWithAlert("缺少 sToken，无法取消预约");
          return;
        }

        // 场馆规则（尽力获取，失败不阻断）
        if (current.libId && !libRule) {
          try {
            setLibRule(await getLibRule(cookieStr.trim(), current.libId, apiConfig));
          } catch {
            log.warn("场馆规则获取失败，按默认节奏续约");
          }
        }

        log.info(`第 ${rounds + 1} 轮：取消 ${current.libName ?? ""} ${current.seatName ?? ""} 号…`);
        setPhase("cancelling");
        setNextActionAt(null);
        const cancelResult = await cancelReservation(cookieStr.trim(), current.sToken, apiConfig, lduFallback);
        if (!cancelResult.success) throw new Error(`取消失败：${cancelResult.message}`);

        // 取消后等待（冷却，规避服务端重订限制）
        const waitSec = Math.max(0, delaySecRef.current);
        log.info(`已取消，等待 ${waitSec}s 后重订…`);
        setPhase("cooldown");
        setNextActionAt(Date.now() + waitSec * 1000);
        setNextActionLabel("重订");
        await new Promise<void>((resolve) => {
          clearTimer();
          timerRef.current = setTimeout(resolve, waitSec * 1000);
        });
        if (stoppedRef.current) return;

        const ok = await rebook(current);
        if (stoppedRef.current) return;
        if (ok) {
          setConsecutiveFails(0);
          setRounds((r) => r + 1);
          setMessage(`第 ${rounds + 1} 轮续约完成`);
          notify("续约成功", `第 ${rounds + 1} 轮已完成，将继续自动续约`);
          await scheduleNextRound(null);
        }
      } catch (e) {
        if (stoppedRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        const fails = consecutiveFails + 1;
        setConsecutiveFails(fails);
        log.error(`第 ${fails} 次连续失败：${msg}`);
        if (fails >= MAX_CONSECUTIVE_FAILURES) {
          abortWithAlert(msg);
          return;
        }
        setMessage(`本轮失败（${msg}），将在下一轮重试`);
        // 失败后退避：等待一个冷却周期后再试
        setPhase("waiting");
        const waitSec = Math.max(5, delaySecRef.current);
        setNextActionAt(Date.now() + waitSec * 1000);
        setNextActionLabel("重试");
        clearTimer();
        timerRef.current = setTimeout(() => {
          if (!stoppedRef.current) void runRound(null);
        }, waitSec * 1000);
      }
    },
    [cookieStr, apiConfig, lduFallback, rounds, consecutiveFails, libRule, stop, abortWithAlert, rebook, scheduleNextRound],
  );

  const start = useCallback(async () => {
    if (running) return;
    if (cookieBlocked(useAuthStore.getState().cookieStatus)) {
      setMessage("Cookie 已失效，请回首页重新扫码后再开启续约");
      return;
    }
    setMessage("");
    const current = await getReservation(cookieStr.trim(), apiConfig).catch(() => null);
    if (!current || !current.seatName) {
      setMessage("当前无有效预约，无法启动续约");
      return;
    }
    if (current.forbidWechatCancle) {
      setMessage("当前预约被标记为禁止取消，无法启动续约");
      return;
    }
    if (!current.sToken) {
      setMessage("缺少 sToken，无法启动续约");
      return;
    }

    stoppedRef.current = false;
    setRunning(true);
    setRounds(0);
    setConsecutiveFails(0);
    setLibRule(null);
    setReservation(current);
    log.info(`续约启动：${current.libName ?? ""} ${current.seatName ?? ""} 号`);
    await scheduleNextRound(current);
  }, [running, cookieStr, apiConfig, scheduleNextRound]);

  useEffect(() => {
    if (running && (!cookieStr || cookieStr.trim().length < 10 || cookieBlocked(useAuthStore.getState().cookieStatus))) {
      stop("Cookie 已失效，续约停止");
    }
  }, [cookieStr, running, stop, cookieStatus]);

  useEffect(() => () => {
    stoppedRef.current = true;
    clearTimer();
  }, []);

  const remainingText =
    nextActionAt !== null && running ? formatRemaining(nextActionAt - now) : null;

  return {
    running,
    phase,
    rounds,
    consecutiveFails,
    nextActionLabel,
    remainingText,
    message,
    reservation,
    libRule,
    start,
    stop,
  };
}
