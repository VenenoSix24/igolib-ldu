import { useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, X, RefreshCw, ClipboardPaste, AlertCircle } from "lucide-react";
import { AuthService } from "@/services/AuthService";
import type { ApiConfig } from "@/lib/api-config";
import { QRCodeCanvas } from "qrcode.react";

interface AuthQrDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig: ApiConfig;
  onCookie: (cookie: string) => void;
}

/** 微信扫码授权获取 Cookie 的弹窗 */
export function AuthQrDialog({ isOpen, onClose, apiConfig, onCookie }: AuthQrDialogProps) {
  const [authInputUrl, setAuthInputUrl] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuthExchange = async () => {
    if (!authInputUrl) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cookie = await AuthService.exchangeCodeForCookie(authInputUrl);
      onCookie(cookie);
      onClose();
      setAuthInputUrl("");
      setAuthError(null);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.3)] backdrop-blur-[6px] dark:bg-[rgba(2,6,23,0.55)]"
            onClick={onClose}
          />

          {/* 居中定位 wrapper：motion 只做浮入动画，不参与定位 transform */}
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.985, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.25, ease: [0.3, 1.15, 0.4, 1] }}
              className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--gborder)] bg-[var(--glass-3)] shadow-2xl backdrop-blur-2xl"
            >
            <div className="flex items-center justify-between border-b border-[var(--line2)] p-4">
              <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
                <KeyRound className="h-[18px] w-[18px] text-pri-text dark:text-acc-hi" />
                扫码获取 Cookie
              </h2>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-full p-1.5 text-mut transition-colors hover:bg-[rgba(100,116,139,0.12)] hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--pri)] text-[10px] font-bold text-[var(--pri-ink)]">1</span>
                  <span className="text-[13px] font-bold">使用微信扫描下方二维码</span>
                </div>
                <div className="flex justify-center">
                  <div className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
                    <QRCodeCanvas
                      value={AuthService.buildAuthUrl(apiConfig.wxAppId, apiConfig.apiUrl)}
                      size={160}
                      level="H"
                    />
                  </div>
                </div>
                <p className="text-center text-[11px] text-sub">
                  扫码后在微信中完成授权，然后点右上角「···」复制链接
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--pri)] text-[10px] font-bold text-[var(--pri-ink)]">2</span>
                  <span className="text-[13px] font-bold">粘贴复制的回调链接</span>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      placeholder="https://xxxx/graphql/?code=xxx&state=1"
                      value={authInputUrl}
                      onChange={(e) => setAuthInputUrl(e.target.value)}
                      className="input mono pr-9 text-[11.5px]"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await readText();
                          if (text) setAuthInputUrl(text.trim());
                        } catch {
                          alert("无法获取剪贴板内容，请手动长按输入框粘贴");
                        }
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-sub transition-colors hover:text-ink"
                      title="从剪贴板粘贴"
                    >
                      <ClipboardPaste className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleAuthExchange}
                    disabled={authLoading || !authInputUrl}
                    className="btn grad w-full"
                  >
                    {authLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {authLoading ? "解析中…" : "解析并粘贴 Cookie"}
                  </button>
                </div>
              </div>
            </div>

            {authError && (
              <div className="mx-5 mb-4 rounded-[14px] border border-[rgba(244,63,94,0.25)] bg-[rgba(244,63,94,0.08)] p-3">
                <p className="flex items-center gap-2 text-[11.5px] text-err-ink dark:text-[#fda4af]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {authError}
                </p>
              </div>
            )}

            <div className="border-t border-[var(--line2)] px-5 py-3">
              <p className="text-center text-[10px] text-sub">
                链接仅用于本地解析 Code，不会向第三方上传
              </p>
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
