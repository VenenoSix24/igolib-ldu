import { useEffect, useMemo, useRef, useState } from "react";
import { formatRemaining, getCookieExpiry } from "@/lib/jwt";
import { notify } from "@/lib/notify";

/**
 * Cookie 到期状态：30s 轮询剩余时长；
 * 进入提醒窗口（剩余 <= reminderMinutes）时发一次系统通知。
 */
export function useCookieExpiry(cookieStr: string, reminderMinutes: number) {
  const expiry = useMemo(() => getCookieExpiry(cookieStr), [cookieStr]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = expiry !== null ? expiry - now : null;
  const expired = remaining !== null && remaining <= 0;
  const expiring = remaining !== null && !expired && remaining <= reminderMinutes * 60_000;

  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!expiring || notifiedRef.current) return;
    notifiedRef.current = true;
    notify("Cookie 即将到期", `剩余不足 ${formatRemaining(remaining!)}，请回首页重新扫码获取`);
  }, [expiring, remaining]);

  return {
    expiry,
    remaining,
    expiring,
    expired,
    remainingText: remaining !== null ? formatRemaining(remaining) : null,
  };
}
