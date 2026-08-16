import { useState } from "react";
import { Armchair, CalendarX2, Clock3, RefreshCw, Timer } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-green-600 dark:text-green-300">
          <Armchair className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold">
            当前预约：{reservation.seatName ? `${reservation.seatName} 号` : "—"}
            {reservation.libName ? ` · ${reservation.libName}` : ""}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
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
            className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
          {confirming ? (
            <span className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>再想想</Button>
              <Button size="sm" onClick={doCancel} disabled={cancelling} className="bg-red-500 hover:bg-red-600 text-white">
                {cancelling ? "取消中…" : "确认取消"}
              </Button>
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
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-600 transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300"
            >
              <CalendarX2 className="h-3.5 w-3.5" />
              {reservation.forbidWechatCancle ? "禁止取消" : "取消预约"}
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className={cn("mt-2 text-[11px]", message.includes("已取消") ? "text-green-600 dark:text-green-300" : "text-red-500")}>
          {message}
        </p>
      )}
    </GlassCard>
  );
}
