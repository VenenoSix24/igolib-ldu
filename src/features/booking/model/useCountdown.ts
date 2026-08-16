import { useEffect, useState } from "react";
import type { ExecTime } from "@/stores/settings";

/** 计划执行时间倒计时（200ms tick，与 1.0 一致）；defaultTime 为模式默认时间（HH:MM） */
export function useCountdown(execTime: ExecTime, customTime: string, defaultTime = "21:48") {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 200);
    return () => clearInterval(timer);
  }, []);

  function getTargetDate(): Date | null {
    if (execTime === "immediate") return null;

    let timeStr = "";
    if (execTime === "2148") timeStr = `${defaultTime}:00`;
    else if (execTime === "custom" && customTime) timeStr = customTime;

    if (!timeStr) return null;

    const [h, m, s] = timeStr.split(":").map(Number);
    const target = new Date();
    target.setHours(h || 0, m || 0, s || 0, 0);

    // 如果目标时间已过，则假设是明天的这个时间
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  const targetDate = getTargetDate();

  if (!targetDate) return null;

  const diff = targetDate.getTime() - now.getTime();
  if (diff < 0) return "00:00:00";

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
