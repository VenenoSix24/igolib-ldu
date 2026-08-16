import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OpMode, ExecTime } from "@/stores/settings";
import type { TaskStatus } from "../model/useBookingTask";

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

export function ConfirmDialog({
  open, onOpenChange, onConfirm, opMode, execTime, customTime, defaultTime, roomName, seatNumber,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] max-w-sm !rounded-2xl overflow-hidden bg-white dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 shadow-2xl p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>确认启动任务</DialogTitle>
            <DialogDescription>请确认以下配置信息无误</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 dark:bg-neutral-900 p-4 rounded-lg space-y-3 text-sm border dark:border-neutral-800">
            <div className="flex justify-between">
              <span className="text-slate-500">操作模式</span>
              <span className="font-bold dark:text-slate-200">
                {opMode === "immediate" ? "立即抢座" : "明日预约"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">触发时间</span>
              <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                {execTime === "immediate" ? "现在 (Now)" : (execTime === "2148" ? `${defaultTime ?? "21:48"}:00` : customTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">阅览室</span>
              <span className="font-bold max-w-[200px] truncate block text-right dark:text-slate-200">{roomName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">座位号</span>
              <span className="font-bold font-mono dark:text-slate-200">{seatNumber}</span>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">确认</Button>
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
      <DialogContent className="w-[90%] max-w-[340px] rounded-2xl p-4 sm:p-6 bg-white dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 shadow-2xl" aria-describedby={undefined}>
        <DialogHeader className="sr-only">
          <DialogTitle>
            {status === "success" ? "任务成功" : status === "cancelled" ? "任务已取消" : "任务失败"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center pt-2 pb-1">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mb-3 shadow-inner",
              status === "success" && "bg-green-100 dark:bg-green-900/30 text-green-600",
              status === "failed" && "bg-red-100 dark:bg-red-900/30 text-red-600",
              status === "cancelled" && "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
            )}
          >
            {status === "success" ? <CheckCircle2 className="w-7 h-7" /> :
              status === "cancelled" ? <StopCircle className="w-7 h-7" /> :
                <AlertCircle className="w-7 h-7" />}
          </motion.div>

          <h2 className={cn(
            "text-lg font-bold text-center tracking-tight",
            status === "success" && "text-green-700 dark:text-green-300",
            status === "failed" && "text-red-700 dark:text-red-300",
            status === "cancelled" && "text-amber-700 dark:text-amber-300"
          )}>
            {status === "success" ? "🎉 任务成功！" :
              status === "cancelled" ? "任务已取消" :
                "任务失败"}
          </h2>

          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 text-center mt-1.5 px-2 leading-relaxed">
            {status === "success" ? "座位预约成功，请按时到馆" :
              status === "cancelled" ? "任务已被用户主动取消" :
                latestLog}
          </p>
        </div>

        {status === "success" && (
          <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-xl mt-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-400">场馆</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                  {roomName || "阅览室"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-400">座位</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{seatNumber} 号</span>
              </div>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-3 rounded-xl mt-1">
            <p className="text-red-600 dark:text-red-400 text-[12px] text-center font-medium">
              {latestLog.includes("Cookie") ? "💡 请更新 Cookie 后重试" : "💡 请检查网络或配置后重试"}
            </p>
          </div>
        )}

        <DialogFooter className="mt-4 sm:mt-5">
          <Button
            onClick={() => onOpenChange(false)}
            className={cn(
              "w-full h-10 font-bold rounded-xl transition-all active:scale-[0.97]",
              status === "success" && "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20",
              status === "failed" && "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20",
              status === "cancelled" && "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
            )}
          >
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
