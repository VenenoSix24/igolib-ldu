import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./ui/dialog";
import { Sparkles, Download, ArrowUp, Clock } from "lucide-react";

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
    hidden: { opacity: 0, y: 10, scale: 0.985 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" as const } },
    exit: { opacity: 0, scale: 0.985, transition: { duration: 0.2 } }
  };

  return (
    <Dialog open={!!update} onOpenChange={(open) => !open && !isUpdating && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[90vw] max-w-[380px] gap-0 overflow-hidden rounded-3xl border-[var(--gborder)] bg-[var(--glass-3)] p-0 shadow-2xl backdrop-blur-2xl sm:max-w-[420px]"
      >
        <div className="relative flex flex-col p-5 sm:p-6">
          <AnimatePresence mode="wait">
            {!isUpdating ? (
              <motion.div
                key="info"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex w-full flex-col items-start text-left"
              >
                <div className="mb-5 flex w-full items-center gap-4">
                  {!imgError ? (
                    <img
                      src="/app-icon.png"
                      alt="App Icon"
                      className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-lg"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-acc to-pri text-[var(--pri-ink)] shadow-lg">
                      <Sparkles className="h-7 w-7" fill="currentColor" fillOpacity={0.2} />
                    </div>
                  )}

                  <div className="flex min-w-0 flex-col">
                    <DialogTitle className="truncate text-[17px] font-extrabold tracking-tight">
                      版本更新
                    </DialogTitle>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="mono flex items-center gap-1.5 rounded-[10px] border border-[var(--line)] bg-[var(--glass-2)] px-2 py-0.5">
                        <span className="text-[10px] font-medium text-mut">v{currentVersion}</span>
                        <ArrowUp className="h-3 w-3 rotate-45 text-pri-text dark:text-acc-hi" />
                        <span className="text-[10px] font-bold">v{update?.version}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 w-full text-left">
                  <div className="mb-2 pl-1 text-[10.5px] font-semibold tracking-wide text-sub">
                    更新内容
                  </div>
                  <div className="max-h-[150px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[var(--line2)] bg-[var(--glass-2)] p-4 text-[12.5px] leading-relaxed text-mut custom-scrollbar">
                    {update?.body || "性能优化与问题修复"}
                  </div>
                </div>

                {error && (
                  <div className="mb-4 w-full rounded-[14px] border border-[rgba(244,63,94,0.25)] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-[11.5px] text-err-ink dark:text-[#fda4af]">
                    {error}
                  </div>
                )}

                <div className="grid w-full grid-cols-2 gap-3">
                  <button type="button" className="btn ghost h-10" onClick={onClose}>
                    <Clock className="h-4 w-4" />
                    暂不更新
                  </button>
                  <button type="button" className="btn grad h-10" onClick={handleUpdate}>
                    <Download className="h-4 w-4" />
                    立即更新
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="progress"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex w-full flex-col items-center py-6 text-center"
              >
                <div className="w-full max-w-[240px] space-y-8">
                  <div className="relative mx-auto h-16 w-16">
                    <div className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--pri)_35%,transparent)] blur-2xl" />
                    <div className="relative grid h-full w-full animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-acc to-pri text-[var(--pri-ink)]">
                      <Download className="h-8 w-8" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[15px] font-bold">正在更新</h3>
                    <p className="px-4 text-[12.5px] text-mut">
                      正在下载并安装新版本，完成后应用将自动重启。
                    </p>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(100,116,139,0.2)]">
                    <motion.div
                      className="h-full bg-gradient-to-r from-pri-deep to-acc"
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
