import { useState } from "react";
import { Armchair, CalendarX2, Clock3, RefreshCw, Timer } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import { cancelReservation } from "@/services/api";
import { notify } from "@/lib/notify";
import { createLogger } from "@/lib/logger";
import type { ReservationInfo } from "@/services/LibraryService";

const log = createLogger("取消预约");

/**
 * 当前预约卡：座位 / 时段 / 签到截止 + 取消按钮。
 * forbidWechatCancle 为真或缺少 sToken 时禁用取消。
 */
export function ReservationCard({
  reservation, refreshing, onRefresh, onCancelled,
}: {
  reservation: ReservationInfo;
  refreshing: boolean;
  onRefresh: () => void;
  onCancelled?: () => void;
}) {
  const apiConfig = useSettingsStore((s) => s.api);
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const lduFallback = useSettingsStore((s) => s.prefs.lduFallbackEnabled);

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");

  const cancelDisabled = reservation.forbidWechatCancle || !reservation.sToken;

  const doCancel = async () => {
    setConfirming(false);
    setCancelling(true);
    setMessage("");
    try {
      const result = await cancelReservation(cookieStr, reservation.sToken as string, apiConfig, lduFallback);
      setMessage(result.message);
      if (result.success) {
        log.info(`已取消预约：${reservation.libName} ${reservation.seatName} 号`);
        notify("预约已取消", `${reservation.libName ?? ""} ${reservation.seatName ?? ""} 号`);
        onCancelled?.();
        onRefresh();
      } else {
        log.error(`取消失败：${result.message}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(msg);
      log.error(`取消失败：${msg}`);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <GlassCard className="p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-acc to-pri text-[var(--pri-ink)] shadow-[0_6px_14px_-4px_color-mix(in_srgb,var(--pri)_50%,transparent)]">
          <Armchair className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold">
            当前预约：{reservation.seatName ? `${reservation.seatName} 号` : "—"}
            {reservation.libName ? ` · ${reservation.libName}` : ""}
          </div>
          <div className="mono mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-mut">
            {reservation.stime && (
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{reservation.stime}{reservation.etime ? ` – ${reservation.etime}` : ""}</span>
            )}
            {reservation.validateDate && (
              <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />签到截止 {reservation.validateDate}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="刷新当前预约"
            onClick={onRefresh}
            disabled={refreshing || cancelling}
            className="cursor-pointer rounded-[10px] p-2 text-sub transition-colors hover:bg-[rgba(100,116,139,0.1)] hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
          {confirming ? (
            <span className="flex items-center gap-1.5">
              <button type="button" className="btn ghost sm" onClick={() => setConfirming(false)}>再想想</button>
              <button type="button" className="btn danger sm" onClick={doCancel} disabled={cancelling}>
                {cancelling ? "取消中…" : "确认取消"}
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={cancelDisabled || cancelling}
              title={
                reservation.forbidWechatCancle
                  ? "当前时段禁止取消（签到后限制）"
                  : !reservation.sToken
                    ? "缺少取消凭证（sToken）"
                    : undefined
              }
              onClick={() => setConfirming(true)}
              className="btn danger sm"
            >
              <CalendarX2 className="h-3.5 w-3.5" />
              {reservation.forbidWechatCancle ? "禁止取消" : "取消预约"}
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className={cn("mt-2 text-[11px]", message.includes("已取消") ? "text-ok-ink dark:text-[#6ee7b7]" : "text-err-ink dark:text-[#fda4af]")}>
          {message}
        </p>
      )}
    </GlassCard>
  );
}
