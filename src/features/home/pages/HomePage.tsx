import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ChevronRight, Eye, EyeOff, KeyRound, Monitor,
  Moon, QrCode, Settings2, Sun,
} from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/glass/GlassCard";
import { CardHead } from "@/components/glass/CardHead";
import { ReservationCard } from "@/features/booking/components/ReservationCard";
import { useReservation } from "@/features/booking/model/useReservation";
import { AuthQrDialog } from "@/components/AuthQrDialog";
import { SettingsModal } from "@/components/SettingsModal";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useRuntimeStore } from "@/stores/runtime";
import { ACCENTS, useThemeStore } from "@/stores/theme";
import { validateUser } from "@/services/api";
import { cn } from "@/lib/utils";
import { useCookieExpiry } from "@/lib/useCookieExpiry";
import { LogsPanel } from "../../logs/components/LogsPanel";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了，早点休息吧～";
  if (h < 12) return "早上好，新的一天元气满满哦";
  if (h < 18) return "下午好，慢慢学，总会有收获";
  return "晚上好，要注意劳逸结合哦";
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** dev 调试：模拟灵动岛运行态与结果事件（生产构建剔除） */
function IslandDebug() {
  const [on, setOn] = useState(false);
  const toggle = () => {
    const s = useRuntimeStore.getState();
    const next = !on;
    setOn(next);
    s.setDebug(next);
    if (next) {
      s.setContext("三楼阅览区 · 056 号");
      s.setBookingRunning(true);
    } else {
      s.setBookingRunning(false);
      s.setContext("");
    }
  };
  return (
    <div className="mt-2 border-t border-[var(--line2)] pt-2.5">
      <p className="mb-1.5 px-1 text-[12px] font-bold">灵动岛调试</p>
      <div className="flex flex-wrap gap-1.5 px-1">
        <button type="button" className={cn("btn sm", on ? "danger" : "dark")} onClick={toggle}>
          {on ? "停止模拟" : "模拟任务运行"}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => useRuntimeStore.getState().pushEvent("success", "预约成功 · 三楼阅览区 056 号")}
        >
          模拟成功事件
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => useRuntimeStore.getState().pushEvent("error", "预约失败 · 座位已被抢占")}
        >
          模拟失败事件
        </button>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const apiConfig = useSettingsStore((s) => s.api);
  const setApi = useSettingsStore((s) => s.setApi);
  const prefs = useSettingsStore((s) => s.prefs);
  const setPrefs = useSettingsStore((s) => s.setPrefs);
  const booking = useSettingsStore((s) => s.booking);
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const cookieStr = booking.cookieStr;
  const setCookieStr = (cookieStr: string) => useSettingsStore.getState().setBooking({ cookieStr });
  const { expiry, remainingText, expiring, expired } = useCookieExpiry(cookieStr, prefs.cookieReminderMinutes);
  const expiryText = expiry !== null
    ? `${new Date(expiry).getMonth() + 1}/${String(new Date(expiry).getDate()).padStart(2, "0")} ${pad2(new Date(expiry).getHours())}:${pad2(new Date(expiry).getMinutes())}`
    : null;
  const setCookieStatus = useAuthStore((s) => s.setCookieStatus);
  const { reservation, loading: loadingReservation, refresh: refreshReservation } = useReservation(cookieStr, apiConfig);
  const bookingRunning = useRuntimeStore((s) => s.bookingRunning);
  const scanning = useRuntimeStore((s) => s.scanning);
  const renewing = useRuntimeStore((s) => s.renewing);

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

  const teeth = [
    { label: "身份", st: ready ? "ok" : cookieStr.trim() ? "miss" : "idle", to: "/app/home" },
    { label: "场馆", st: booking.libId ? "ok" : "idle", to: "/app/tomorrow" },
    { label: "座位", st: booking.seatNumber ? "ok" : "idle", to: "/app/tomorrow" },
    { label: "时间", st: booking.tomorrowExecTime !== "custom" || booking.customTime ? "ok" : "idle", to: "/app/tomorrow" },
  ] as const;

  // 一句话系统状态（运行任务优先于就绪度）
  const stateText = bookingRunning
    ? "预约任务执行中"
    : scanning
      ? "场馆捡漏扫描中"
      : renewing
        ? "占座续约运行中"
        : ready
          ? "任务就绪"
          : "待配置身份";
  const stateOk = bookingRunning || scanning || renewing || ready;

  const statusPill = validating ? (
    <span className="pill warn"><span className="ping" />验证中</span>
  ) : ready ? (
    <span className="pill ok"><span className="dot" />身份有效</span>
  ) : expired ? (
    <span className="pill err"><span className="dot" />已到期</span>
  ) : userInfo && !userInfo.valid ? (
    <span className="pill err"><span className="dot" />Cookie 无效</span>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 中枢 hero：系统状态 + 就绪梳 + 右侧双入口 */}
      <GlassCard className="hero rise p-5 md:p-7">
        <div className="md:flex md:items-center md:gap-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-extrabold tracking-[-0.02em]">{greeting()}</h1>
            <p className="mt-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-mut">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                stateOk ? "bg-[var(--ok)]" : "bg-[var(--warn)]",
                (bookingRunning || scanning || renewing) && "animate-pulse",
              )} />
              {stateText}
            </p>
            <div className="teeth mt-6">
              {teeth.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className={cn("tooth", t.st === "ok" && "ok", t.st === "miss" && "miss")}
                  onClick={() => navigate(t.to)}
                >
                  <i />{t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 shrink-0 md:mt-0 md:w-[190px]">
            <button type="button" className="btn grad big w-full" onClick={() => navigate("/app/tomorrow")}>
              明日预约
            </button>
            <button type="button" className="btn dark big mt-2.5 w-full" onClick={() => navigate("/app/grab")}>
              立即抢座
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 当前预约 */}
      {reservation?.seatName && (
        <ReservationCard
          reservation={reservation}
          refreshing={loadingReservation}
          onRefresh={() => void refreshReservation()}
        />
      )}

      {/* 身份与常用设置 */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {/* 身份与 Cookie */}
        <GlassCard className="rise p-4 md:p-5">
          <CardHead
            icon={KeyRound}
            tile="ti-pri"
            title="身份与 Cookie"
            hint={statusPill ?? <span className="pill slate"><span className="dot" />未配置身份</span>}
          />

          <div className="mt-3.5">
            <div className="relative">
              <input
                type={showCookie ? "text" : "password"}
                placeholder="粘贴 Cookie，或点下方扫码获取"
                value={cookieStr}
                onChange={(e) => setCookieStr(e.target.value)}
                autoComplete="off"
                className={cn(
                  "input mono pr-10 text-[11.5px]",
                  ready && "border-[rgba(16,185,129,.45)]",
                  userInfo && !userInfo.valid && "border-[rgba(244,63,94,.45)]",
                )}
              />
              <button
                type="button"
                aria-label={showCookie ? "隐藏 Cookie" : "显示 Cookie"}
                onClick={() => setShowCookie(!showCookie)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-sub hover:text-ink"
              >
                {showCookie ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {expiryText && !expired && (
              <p className="mt-2 text-[10.5px] tabular-nums text-mut">到期时间 {expiryText} · 剩 {remainingText}</p>
            )}
            {(expiring || expired) && (
              <div className={cn(
                "mt-2.5 flex items-center gap-2 rounded-[14px] border px-3 py-2 text-[11px]",
                expired
                  ? "border-[rgba(244,63,94,.25)] bg-[rgba(244,63,94,.08)] text-err-ink dark:text-[#fda4af]"
                  : "border-[rgba(245,158,11,.25)] bg-[rgba(245,158,11,.08)] text-warn-ink dark:text-[#fcd34d]",
              )}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{expired ? "Cookie 已到期，请重新扫码" : `Cookie 即将到期，剩 ${remainingText}`}</span>
                <button type="button" className="btn ghost sm shrink-0" onClick={() => setShowQr(true)}>重新扫码</button>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-3">
            <button type="button" className="btn grad sm" onClick={() => setShowQr(true)}>
              <QrCode className="h-3.5 w-3.5" />扫码获取 Cookie
            </button>
          </div>
        </GlassCard>

        {/* 常用设置 */}
        <GlassCard className="rise p-4 md:p-5">
          <CardHead icon={Settings2} tile="ti-slate" title="常用设置" />

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex h-[46px] cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3.5 text-left transition-colors hover:border-[var(--line2)] hover:bg-[var(--glass-3)]"
            >
              <span className="text-[12px] font-semibold">API 预设</span>
              <span className="flex items-center gap-1 text-[12px] text-mut">
                {apiConfig.preset === "ldu" ? "卤蛋大学" : apiConfig.preset === "official" ? "官方原版" : "自定义"}
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <label className="flex h-[46px] cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3.5 transition-colors hover:border-[var(--line2)]">
              <span className="text-[12px] font-semibold">明日默认时间</span>
              <span className="flex h-[30px] items-center justify-center gap-1 rounded-[10px] border border-[var(--line)] bg-[var(--glass-3)] px-2.5">
                <input
                  type="time"
                  aria-label="明日默认执行时间"
                  value={prefs.defaultExecTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d{2}:\d{2}$/.test(v)) setPrefs({ defaultExecTime: v });
                  }}
                  className="cursor-pointer border-0 bg-transparent p-0 text-center font-mono text-[12px] tabular-nums outline-none"
                />
              </span>
            </label>

            <label className="flex h-[46px] cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3.5 transition-colors hover:border-[var(--line2)]">
              <span className="text-[12px] font-semibold">Cookie 到期提醒</span>
              <select
                aria-label="Cookie 到期提醒提前量"
                value={prefs.cookieReminderMinutes}
                onChange={(e) => setPrefs({ cookieReminderMinutes: Number(e.target.value) })}
                className="select h-[30px] w-[112px] rounded-[10px] text-[11.5px]"
              >
                {[5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>提前 {m} 分钟</option>
                ))}
              </select>
            </label>

            <div className="flex h-[46px] items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3.5">
              <span className="text-[12px] font-semibold">深浅色</span>
              <div className="seg">
                {([
                  { m: "light", title: "浅色", icon: Sun },
                  { m: "dark", title: "深色", icon: Moon },
                  { m: "system", title: "跟随系统", icon: Monitor },
                ] as const).map(({ m, title, icon: Icon }) => (
                  <button
                    key={m}
                    type="button"
                    title={title}
                    aria-label={`主题：${title}`}
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={cn("flex items-center justify-center px-0", mode === m && "on")}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-[46px] flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[14px] border border-[var(--line)] bg-[var(--glass-2)] px-3.5 py-2">
              <span className="text-[12px] font-semibold">强调色</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    title={a.name}
                    aria-label={`强调色：${a.name}`}
                    aria-pressed={accent === a.id}
                    onClick={() => setAccent(a.id)}
                    className={cn("accdot h-5 w-5", accent === a.id && "on")}
                    style={{ background: a.hex }}
                  />
                ))}
              </span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              aria-expanded={showMore}
              className="flex cursor-pointer items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-semibold text-mut transition-colors hover:bg-[var(--glass-3)] hover:text-ink"
            >
              更多设置
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-90")} />
            </button>
            <button
              type="button"
              onClick={() => navigate("/app/about")}
              className="ml-auto flex cursor-pointer items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-semibold text-mut transition-colors hover:bg-[var(--glass-3)] hover:text-ink"
            >
              关于
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {showMore && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-1 rounded-[16px] border border-[var(--line)] bg-[rgba(100,116,139,0.06)] p-3">
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-[12px] font-bold">LDU 兼容模式</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs.lduFallbackEnabled}
                    onClick={() => setPrefs({ lduFallbackEnabled: !prefs.lduFallbackEnabled })}
                    className={cn("switch", prefs.lduFallbackEnabled && "on")}
                  />
                </div>
                <p className="px-1 text-[10.5px] leading-relaxed text-mut">
                  预约失败时自动换官方接口名重试（备用通道，默认关闭）
                </p>
                <div className="mt-2 border-t border-[var(--line2)] pt-2.5">
                  <p className="mb-1.5 px-1 text-[12px] font-bold">运行日志</p>
                  <LogsPanel />
                </div>
                {import.meta.env.DEV && <IslandDebug />}
              </div>
            </motion.div>
          )}
        </GlassCard>
      </div>

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
