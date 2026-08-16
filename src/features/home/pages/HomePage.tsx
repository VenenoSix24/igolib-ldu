import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, Eye, EyeOff, Image, KeyRound, Moon, QrCode, Settings2, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/glass/GlassCard";
import { AuthQrDialog } from "@/components/AuthQrDialog";
import { SettingsModal } from "@/components/SettingsModal";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { BUILTIN_WALLPAPERS, thumbOf } from "@/lib/wallpapers";
import { validateUser } from "@/services/api";
import { cn } from "@/lib/utils";
import { useCookieExpiry } from "@/lib/useCookieExpiry";
import { LogsPanel } from "../../logs/components/LogsPanel";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export function HomePage() {
  const navigate = useNavigate();
  const apiConfig = useSettingsStore((s) => s.api);
  const setApi = useSettingsStore((s) => s.setApi);
  const prefs = useSettingsStore((s) => s.prefs);
  const setPrefs = useSettingsStore((s) => s.setPrefs);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const wallpaper = useThemeStore((s) => s.wallpaper);
  const cookieStr = useSettingsStore((s) => s.booking.cookieStr);
  const setCookieStr = (cookieStr: string) => useSettingsStore.getState().setBooking({ cookieStr });
  const { expiry, remainingText, expiring, expired } = useCookieExpiry(cookieStr, prefs.cookieReminderMinutes);
  const expiryText = expiry !== null
    ? `${new Date(expiry).getMonth() + 1}/${String(new Date(expiry).getDate()).padStart(2, "0")} ${String(new Date(expiry).getHours()).padStart(2, "0")}:${String(new Date(expiry).getMinutes()).padStart(2, "0")}`
    : null;
  const setCookieStatus = useAuthStore((s) => s.setCookieStatus);

  const [showCookie, setShowCookie] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; valid: boolean } | null>(null);
  const [validating, setValidating] = useState(false);

  // Cookie 有效性校验（与预约流程一致的 800ms 防抖）；结果写入全局 auth store，
  // 其余页面据此拦截请求，避免失效后反复请求触发风控
  useEffect(() => {
    setUserInfo(null);
    setValidating(false);
    if (!cookieStr || cookieStr.trim().length < 10) {
      setCookieStatus("none");
      return;
    }
    setCookieStatus("unknown");
    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await validateUser(cookieStr.trim(), apiConfig);
        setUserInfo(res.valid ? { name: res.name || "User", valid: true } : { name: "", valid: false });
        setCookieStatus(res.valid ? "valid" : "invalid");
      } catch {
        setUserInfo({ name: "", valid: false });
        setCookieStatus("invalid");
      } finally {
        setValidating(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [cookieStr, apiConfig, setCookieStatus]);

  // 到期优先于「无效」覆盖状态
  useEffect(() => {
    if (expired) setCookieStatus("expired");
  }, [expired, setCookieStatus]);

  const ready = userInfo?.valid === true;

  return (
    <div className="flex flex-col gap-4">
      {/* 欢迎语 */}
      <GlassCard className="p-5 text-center md:p-6">
        <h2 className="text-[17px] font-extrabold">
          {greeting()}，{ready ? "身份就绪，随时可以出手" : "先配置身份再开始抢座"}
        </h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-300">
          {ready
            ? "明日预约 / 立即抢座 / 场馆捡漏 全部可用"
            : "在下方获取或粘贴 Cookie 后，其余页面即可使用"}
        </p>
        {ready && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/app/tomorrow")}
              className="cursor-pointer rounded-full bg-gradient-to-br from-[#b3d0ff] to-[#7da7ff] px-4 py-2 text-[12px] font-bold text-[#10162a] shadow-[0_6px_18px_rgba(125,167,255,0.35)] transition-transform active:scale-[0.97]"
            >
              去明日预约 →
            </button>
            <button
              type="button"
              onClick={() => navigate("/app/grab")}
              className="cursor-pointer rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[12px] font-bold text-slate-700 transition-transform active:scale-[0.97] dark:text-slate-200"
            >
              去立即抢座
            </button>
          </div>
        )}
      </GlassCard>

      {/* 身份 Cookie */}
      <GlassCard className="p-4 md:p-5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-300">
          <KeyRound className="h-3.5 w-3.5" />身份 Cookie
          <span className="ml-auto">
            {validating && <span className="animate-pulse text-[10px] text-blue-500">验证中…</span>}
            {!validating && userInfo?.valid && (
              <span className={cn("text-[10px]", expired ? "text-red-500" : expiring ? "text-amber-500" : "text-green-500")}>
                ● {expired ? "已到期" : expiring ? "即将到期" : "有效"}
              </span>
            )}
            {!validating && userInfo && !userInfo.valid && <span className="text-[10px] text-red-500">● 无效</span>}
            {remainingText && !expired && (
              <span className={cn("ml-1.5 text-[10px]", expiring ? "text-amber-500" : "text-slate-400")}>
                剩 {remainingText}
              </span>
            )}
          </span>
        </div>
        <div className="relative">
          <Input
            type={showCookie ? "text" : "password"}
            placeholder="粘贴 Cookie 或扫码获取…"
            value={cookieStr}
            onChange={(e) => setCookieStr(e.target.value)}
            autoComplete="off"
            className={cn(
              "h-10 pr-10 font-mono text-sm dark:border-white/15",
              userInfo?.valid ? "border-green-500 bg-green-50/10 focus-visible:ring-green-500" :
                (userInfo && !userInfo.valid ? "border-red-500 bg-red-50/10 focus-visible:ring-red-500" : ""),
            )}
          />
          <button
            type="button"
            aria-label={showCookie ? "隐藏 Cookie" : "显示 Cookie"}
            onClick={() => setShowCookie(!showCookie)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
          >
            {showCookie ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {expiryText && !expired && (
          <p className="mt-1.5 text-[10.5px] tabular-nums text-slate-500 dark:text-slate-300">
            到期时间 {expiryText} · 剩 {remainingText}
          </p>
        )}
        {(expiring || expired) && (
          <div className={cn(
            "mt-2.5 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]",
            expired
              ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
          )}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 leading-relaxed">
              {expired ? "Cookie 已到期，预约功能将不可用" : `Cookie 即将到期（剩 ${remainingText}）`}
              ，请重新扫码获取
            </span>
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="shrink-0 cursor-pointer rounded-full bg-white/70 px-2.5 py-1 text-[10.5px] font-bold text-slate-800 transition-transform active:scale-[0.97] dark:bg-white/15 dark:text-slate-100"
            >
              重新扫码
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className="mt-2.5 flex cursor-pointer items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600"
        >
          <QrCode className="h-3 w-3" />扫码获取 / 更新 Cookie
        </button>
      </GlassCard>

      {/* 常用设置 */}
      <GlassCard className="p-4 md:p-5">
        <h3 className="mb-2.5 flex items-center gap-2 text-[13.5px] font-extrabold"><Settings2 className="h-4 w-4" />常用设置</h3>
        <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-white/[0.05]">
          <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">主题</span>
          <span className="flex gap-1 rounded-full bg-slate-200/70 p-1 dark:bg-white/[0.08]">
            {([
              { mode: "light" as ThemeMode, icon: Sun, label: "浅色" },
              { mode: "dark" as ThemeMode, icon: Moon, label: "深色" },
              { mode: "wallpaper" as ThemeMode, icon: Image, label: "壁纸" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                type="button"
                aria-label={`主题：${label}`}
                aria-pressed={themeMode === mode}
                onClick={() => setThemeMode(mode)}
                className={
                  themeMode === mode
                    ? "flex cursor-pointer items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#131a2a] shadow-sm dark:bg-white/90"
                    : "flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </span>
        </div>
        {themeMode === "wallpaper" && (
          <div className="mt-2 space-y-2">
            <p className="px-0.5 text-[10.5px] text-slate-400 dark:text-slate-300">选择壁纸</p>
            <div className="flex gap-2">
              {BUILTIN_WALLPAPERS.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => { setThemeMode("wallpaper"); useThemeStore.getState().setWallpaper(url); }}
                  aria-label="内置壁纸"
                  className="h-14 w-14 cursor-pointer overflow-hidden rounded-xl border-2 transition-all hover:scale-105 active:scale-95"
                  style={{
                    backgroundImage: `url(${thumbOf(url)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    borderColor: wallpaper === url ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
              <label className="flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed transition-colors hover:border-white/40 active:scale-95" style={{ borderColor: wallpaper.startsWith("data:") ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}>
                <span className="text-[16px] leading-none">+</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-300">自定义</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") {
                        useThemeStore.getState().setWallpaper(reader.result);
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        )}

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-200/70 dark:bg-white/[0.05] dark:hover:bg-white/[0.09]"
          >
            <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">API 预设</span>
            <span className="flex items-center gap-1 text-[11.5px] text-slate-500">
              {apiConfig.preset === "ldu" ? "卤蛋大学" : apiConfig.preset === "official" ? "官方原版" : "自定义"}
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-white/[0.05]">
            <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">明日默认时间</span>
            <input
              type="time"
              aria-label="明日默认执行时间"
              value={prefs.defaultExecTime}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{2}:\d{2}$/.test(v)) setPrefs({ defaultExecTime: v });
              }}
              className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white/80 px-2 text-center font-mono text-[12px] text-slate-800 focus:border-blue-500 focus:outline-none dark:border-white/15 dark:bg-white/[0.08] dark:text-slate-100"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-white/[0.05]">
            <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">Cookie 到期提醒</span>
            <select
              aria-label="Cookie 到期提醒提前量"
              value={prefs.cookieReminderMinutes}
              onChange={(e) => setPrefs({ cookieReminderMinutes: Number(e.target.value) })}
              className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white/80 px-2 text-center text-[12px] text-slate-800 focus:border-blue-500 focus:outline-none dark:border-white/15 dark:bg-white/[0.08] dark:text-slate-100"
            >
              {[5, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>提前 {m} 分钟</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-200/70 dark:bg-white/[0.05] dark:hover:bg-white/[0.09]"
          >
            <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">更多设置</span>
            <ChevronRight className={cn("h-3.5 w-3.5 text-slate-500 transition-transform", showMore && "rotate-90")} />
          </button>
        </div>

        {/* 二级：更多设置 */}
        {showMore && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">LDU 兼容模式</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.lduFallbackEnabled}
                onClick={() => setPrefs({ lduFallbackEnabled: !prefs.lduFallbackEnabled })}
                className={cn(
                  "h-6 w-11 cursor-pointer rounded-full p-0.5 transition-colors",
                  prefs.lduFallbackEnabled ? "bg-blue-500" : "bg-slate-300 dark:bg-white/15",
                )}
              >
                <span className={cn(
                  "block h-5 w-5 rounded-full bg-white shadow transition-transform",
                  prefs.lduFallbackEnabled && "translate-x-5",
                )} />
              </button>
            </div>
            <p className="px-1 text-[10.5px] leading-relaxed text-slate-500">
              预约失败时自动换官方接口名重试（备用通道，默认关闭）
            </p>
            <div className="mt-1 border-t border-white/[0.08] pt-2">
              <p className="mb-1.5 px-1 text-[12px] font-bold text-slate-700 dark:text-slate-200">运行日志</p>
              <LogsPanel />
            </div>
          </div>
        )}
      </GlassCard>

      <AuthQrDialog
        isOpen={showQr}
        onClose={() => setShowQr(false)}
        apiConfig={apiConfig}
        onCookie={(cookie) => setCookieStr(cookie)}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={apiConfig}
        onSave={(config) => setApi(config)}
      />
    </div>
  );
}
