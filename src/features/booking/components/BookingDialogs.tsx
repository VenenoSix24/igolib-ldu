import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, StopCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OpMode, ExecTime } from "@/stores/settings";
import type { TaskStatus } from "../model/useBookingTask";

const SHEET_CLS = "w-[90%] gap-0 overflow-hidden rounded-3xl border-[var(--gborder)] bg-[var(--glass-3)] p-0 backdrop-blur-2xl shadow-2xl";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  opMode: OpMode;
  execTime: ExecTime;
  customTime: string;
  defaultTime?: string;
  roomName?: string;
  seatNumber: string;
}

function ConfirmRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-mut">{label}</span>
      <span className="text-right font-bold">{children}</span>
    </div>
  );
}

export function ConfirmDialog({
  open, onOpenChange, onConfirm, opMode, execTime, customTime, defaultTime, roomName, seatNumber,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_CLS}>
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-extrabold">确认启动任务</DialogTitle>
            <DialogDescription className="text-[12px]">请确认以下配置无误</DialogDescription>
          </DialogHeader>
          <div className="mono mt-4 divide-y divide-[var(--line2)] rounded-2xl border border-[var(--line2)] bg-[var(--glass-2)] px-4 py-1 text-[13px]">
            <ConfirmRow label="操作模式">{opMode === "immediate" ? "立即抢座" : "明日预约"}</ConfirmRow>
            <ConfirmRow label="触发时间">
              {execTime === "immediate" ? "立即" : execTime === "2148" ? `${defaultTime ?? "21:48"}:00` : customTime}
            </ConfirmRow>
            <ConfirmRow label="阅览室"><span className="block max-w-[200px] truncate">{roomName}</span></ConfirmRow>
            <ConfirmRow label="座位号">{seatNumber} 号</ConfirmRow>
          </div>
          <DialogFooter className="mt-5 flex-row gap-2.5">
            <button type="button" className="btn ghost flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>取消</button>
            <button type="button" className="btn grad flex-1 sm:flex-none" onClick={onConfirm}>确认启动</button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: TaskStatus;
  latestLog: string;
  roomName?: string;
  seatNumber: string;
}

export function ResultDialog({
  open, onOpenChange, status, latestLog, roomName, seatNumber,
}: ResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SHEET_CLS, "w-[90%] max-w-[340px] p-4 sm:p-6")} aria-describedby={undefined}>
        <DialogHeader className="sr-only">
          <DialogTitle>
            {status === "success" ? "任务成功" : status === "cancelled" ? "任务已取消" : "任务失败"}
          </DialogTitle>
        </DialogHeader>

        <div className={cn("flex flex-col items-center pb-1 pt-2", status === "success" && "success-sweep rounded-2xl")}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "mb-3 flex h-14 w-14 items-center justify-center rounded-full",
              status === "success" && "bg-[rgba(16,185,129,0.14)] text-ok-ink dark:text-[#6ee7b7]",
              status === "failed" && "bg-[rgba(244,63,94,0.12)] text-err-ink dark:text-[#fda4af]",
              status === "cancelled" && "bg-[rgba(245,158,11,0.12)] text-warn-ink dark:text-[#fcd34d]",
            )}
          >
            {status === "success" ? <CheckCircle2 className="h-7 w-7" /> :
              status === "cancelled" ? <StopCircle className="h-7 w-7" /> :
                <AlertCircle className="h-7 w-7" />}
          </motion.div>

          <h2 className={cn(
            "text-center text-[17px] font-extrabold tracking-tight",
            status === "success" && "text-ok-ink dark:text-[#6ee7b7]",
            status === "failed" && "text-err-ink dark:text-[#fda4af]",
            status === "cancelled" && "text-warn-ink dark:text-[#fcd34d]",
          )}>
            {status === "success" ? "任务成功" :
              status === "cancelled" ? "任务已取消" :
                "任务失败"}
          </h2>

          <p className="mt-1.5 px-2 text-center text-[12.5px] leading-relaxed text-mut">
            {status === "success" ? "座位预约成功，请按时到馆" :
              status === "cancelled" ? "任务已手动取消" :
                latestLog}
          </p>
        </div>

        {status === "success" && (
          <div className="mono mt-1 divide-y divide-[var(--line2)] rounded-2xl border border-[var(--line2)] bg-[var(--glass-2)] px-4 py-1 text-[13px]">
            <div className="flex items-center justify-between py-2">
              <span className="text-mut">场馆</span>
              <span className="max-w-[150px] truncate font-semibold">{roomName || "阅览室"}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-mut">座位</span>
              <span className="font-bold">{seatNumber} 号</span>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="mt-1 rounded-2xl border border-[rgba(244,63,94,0.2)] bg-[rgba(244,63,94,0.06)] p-3">
            <p className="text-center text-[12px] font-medium text-err-ink dark:text-[#fda4af]">
              {latestLog.includes("Cookie") ? "请更新 Cookie 后重试" : "请检查网络或配置后重试"}
            </p>
          </div>
        )}

        <DialogFooter className="mt-4 sm:mt-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              "btn h-10 w-full text-[12.5px]",
              status === "success" && "border-transparent bg-[var(--ok)] text-white hover:brightness-105",
              status === "failed" && "border-transparent bg-[var(--err)] text-white hover:brightness-105",
              status === "cancelled" && "border-transparent bg-[var(--warn)] text-white hover:brightness-105",
            )}
          >
            知道了
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
