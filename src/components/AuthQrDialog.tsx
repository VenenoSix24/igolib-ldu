import { useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, X, RefreshCw, ClipboardPaste, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{ x: "-50%", y: "-50%" }}
            className="fixed left-1/2 top-1/2 w-[90%] max-w-sm bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl z-50 overflow-hidden border dark:border-neutral-800"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-500" />
                扫码获取 Cookie
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">使用微信扫描下方二维码</span>
                </div>
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                    <QRCodeCanvas
                      value={AuthService.buildAuthUrl(apiConfig.wxAppId, apiConfig.apiUrl)}
                      size={160}
                      level="H"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  扫码后在微信中完成授权，然后点击右上角「···」复制链接
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">粘贴复制的回调链接</span>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      placeholder="https://xxxx/graphql/?code=xxx&state=1"
                      value={authInputUrl}
                      onChange={(e) => setAuthInputUrl(e.target.value)}
                      className="w-full pr-9 text-xs font-mono dark:bg-[rgb(16,16,16)] dark:border-neutral-700"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 p-1 transition-colors"
                      title="从剪贴板粘贴"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAuthExchange}
                    disabled={authLoading || !authInputUrl}
                    className="w-full"
                  >
                    {authLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {authLoading ? "解析中..." : "解析并粘贴 Cookie"}
                  </Button>
                </div>
              </div>
            </div>

            {authError && (
              <div className="mx-5 mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {authError}
                </p>
              </div>
            )}

            <div className="px-5 py-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
              <p className="text-[10px] text-slate-400 text-center">
                链接仅用于本地解析 Code，不会向第三方上传
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
