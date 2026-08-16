import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./ui/dialog";
import { Sparkles, Download, ArrowUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

import { openUrl } from '@tauri-apps/plugin-opener';

export interface ManualUpdate {
  version: string;
  body?: string;
  isExternal: true;
  downloadUrl: string;
}

interface UpdateDialogProps {
  update: Update | ManualUpdate | null;
  onClose: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ update, onClose }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // 获取当前应用版本
    getVersion().then(v => setCurrentVersion(v)).catch(console.error);
  }, []);

  const [lastUpdate, setLastUpdate] = useState(update);
  if (update !== lastUpdate) {
    setLastUpdate(update);
    if (update) setImgError(false);
  }

  const handleUpdate = async () => {
    if (!update) return;

    try {
      if ('isExternal' in update && update.isExternal) {
        // 移动端/外部更新：跳转浏览器
        await openUrl(update.downloadUrl);
        onClose();
      } else {
        // 桌面端/原生更新
        setIsUpdating(true);
        setError(null);
        await (update as Update).downloadAndInstall();
        await relaunch();
      }
    } catch (err) {
      console.error("更新失败:", err);
      setError(err instanceof Error ? err.message : "更新过程中发生错误");
      setIsUpdating(false);
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } }
  };

  return (
    <Dialog open={!!update} onOpenChange={(open) => !open && !isUpdating && onClose()}>
      <DialogContent className={cn(
        "w-[90vw] max-w-[380px] sm:max-w-[420px] p-0 border-none shadow-2xl ring-1 ring-black/5 dark:ring-white/10",
        "bg-white dark:bg-[#0f1115]",
        "rounded-[32px] sm:rounded-[32px] overflow-hidden"
      )}>

        <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-blue-50/50 dark:from-blue-900/10 to-transparent pointer-events-none" />

        <div className="relative p-5 sm:p-6 flex flex-col">
          <AnimatePresence mode="wait">
            {!isUpdating ? (
              <motion.div
                key="info"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full flex flex-col items-start text-left"
              >
                <div className="flex items-center gap-4 mb-6 w-full">
                  {!imgError ? (
                    <img
                      src="/app-icon.png"
                      alt="App Icon"
                      className="shrink-0 w-14 h-14 rounded-2xl shadow-lg shadow-pink-500/40 object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 ring-1 ring-black/5">
                      <Sparkles className="w-7 h-7" fill="currentColor" fillOpacity={0.2} />
                    </div>
                  )}

                  <div className="flex flex-col min-w-0">
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                      版本更新
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">v{currentVersion}</span>
                        <ArrowUp className="w-3 h-3 text-blue-500 rotate-45 transform" />
                        <span className="text-[10px] font-bold text-slate-900 dark:text-slate-200">v{update?.version}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full mb-6 text-left">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 pl-1">
                    更新内容
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 ring-1 ring-slate-100 dark:ring-slate-800/50">
                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed custom-scrollbar max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                      {update?.body || "• 性能优化与问题修复\n• 用户体验改进"}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg w-full">
                    {error}
                  </div>
                )}

                <div className="w-full grid grid-cols-2 gap-3">
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    className="h-11 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/50"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    暂不更新
                  </Button>
                  <Button
                    onClick={handleUpdate}
                    className="h-11 rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    立即更新
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="progress"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full py-6 flex flex-col items-center text-center"
              >
                <div className="w-full max-w-[240px] space-y-8">
                  <div className="relative mx-auto w-16 h-16">
                    <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full" />
                    <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center animate-pulse">
                      <Download className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">正在更新...</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 px-4">
                      正在下载并安装新版本，完成后应用将自动重启。
                    </p>
                  </div>

                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 15, ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
