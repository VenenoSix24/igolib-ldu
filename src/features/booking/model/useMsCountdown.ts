import { useEffect, useState } from "react";
import type { ExecTime } from "@/stores/settings";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 毫秒倒计时（真实时间差，70ms 刷新）；immediate 或未设时间返回占位符 */
export function useMsCountdown(execTime: ExecTime, customTime: string, defaultTime: string) {
  const [text, setText] = useState("--:--:--.--");
  useEffect(() => {
    if (execTime === "immediate") return;
    const timeStr = execTime === "2148" ? defaultTime : customTime;
    if (!timeStr) return;
    const [h, m] = timeStr.split(":").map(Number);
    const tick = () => {
      const target = new Date();
      target.setHours(h || 0, m || 0, 0, 0);
      if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
      const ms = Math.max(0, target.getTime() - Date.now());
      setText(`${pad2(Math.floor(ms / 3600000))}:${pad2(Math.floor((ms % 3600000) / 60000))}:${pad2(Math.floor((ms % 60000) / 1000))}.${pad2(Math.floor((ms % 1000) / 10))}`);
    };
    tick();
    const id = setInterval(tick, 70);
    return () => clearInterval(id);
  }, [execTime, customTime, defaultTime]);
  return text;
}

/** 执行档位显示名：默认 21:48 / 自定义 HH:MM / 立即 */
export function execModeLabel(execTime: ExecTime, customTime: string, defaultTime: string): string {
  if (execTime === "immediate") return "立即";
  if (execTime === "2148") return `默认 ${defaultTime}`;
  return customTime ? `自定义 ${customTime}` : "自定义";
}

/** 目标执行时间的展示串（HH:MM:SS）；无有效时间返回占位符 */
export function execTargetTime(execTime: ExecTime, customTime: string, defaultTime: string): string {
  const timeStr = execTime === "2148" ? defaultTime : execTime === "custom" ? customTime : "";
  if (!timeStr) return "--:--:--";
  return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
}

/** 下一次执行的时间戳；immediate 或未设时间返回 null（已过时间顺延到明天） */
export function nextTargetTs(execTime: ExecTime, customTime: string, defaultTime: string): number | null {
  if (execTime === "immediate") return null;
  const timeStr = execTime === "2148" ? defaultTime : customTime;
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const target = new Date();
  target.setHours(h || 0, m || 0, 0, 0);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  return target.getTime();
}
