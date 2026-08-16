import { useEffect, useRef, useState } from "react";
import { submitRequest, cancelTask } from "@/services/api";
import type { ApiConfig } from "@/lib/api-config";

export interface LogEntry {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: string;
  count?: number;
  event?: string;
  data?: Record<string, unknown>;
}

export type TaskStatus = "idle" | "connecting" | "running" | "success" | "failed" | "cancelled";

// 事件类型到日志类型的映射
function eventToLogType(event: string): LogEntry["type"] {
  switch (event) {
    case "success": return "success";
    case "error":
    case "failed": return "error";
    case "warning":
    case "cancelled": return "warning";
    default: return "info";
  }
}

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 缩短长状态消息以便在标题显示
export function formatStatusMessage(msg: string) {
  if (!msg) return "";
  if (msg.includes("不在预约时间内")) {
    return "不在预约时间 (请在 21:48 后尝试)";
  }
  let cleanMsg = msg;
  const prefixes = [
    /^操作失败:\s*/,
    /^状态更新:\s*/,
    /^执行结果:\s*/,
    /^任务失败:\s*/,
    /^座位预约失败:\s*/
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of prefixes) {
      if (p.test(cleanMsg)) {
        cleanMsg = cleanMsg.replace(p, "");
        changed = true;
      }
    }
  }

  if (cleanMsg.length > 30) {
    return cleanMsg.substring(0, 30) + "...";
  }
  return cleanMsg;
}

/** 任务执行与控制台状态（与 1.0 Dashboard 逻辑一致） */
export function useBookingTask() {
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [latestLog, setLatestLog] = useState("就绪");
  const [currentPhase, setCurrentPhase] = useState("idle");
  const [showResultDialog, setShowResultDialog] = useState(false);
  const activeClientIdRef = useRef<string | null>(null);

  // 组件卸载时终止所有活动任务
  useEffect(() => {
    return () => {
      if (activeClientIdRef.current) {
        cancelTask(activeClientIdRef.current);
        activeClientIdRef.current = null;
      }
    };
  }, []);

  const addLog = (
    message: string,
    type: LogEntry["type"] = "info",
    event?: string,
    data?: Record<string, unknown>
  ) => {
    const cleanedMessage = (event === "result" || type === "error") ? formatStatusMessage(message) : message;
    setLatestLog(cleanedMessage);

    if (event === "phase" && data?.phase) {
      setCurrentPhase(data.phase as string);
    } else if (event === "countdown") {
      setCurrentPhase("countdown");
    } else if (event === "success") {
      setCurrentPhase("done");
    } else if (event === "error") {
      setCurrentPhase("failed");
    } else if (event === "cancelled") {
      setCurrentPhase("cancelled");
    }

    setLogs(prev => {
      const lastLog = prev[prev.length - 1];

      // 倒计时消息只更新最后一条
      const isCountdown = event === "countdown";
      const lastIsCountdown = lastLog?.event === "countdown";

      if (isCountdown && lastIsCountdown) {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = {
          ...lastLog,
          message: message,
          timestamp: new Date().toLocaleTimeString(),
          count: (lastLog.count || 1) + 1,
          data: data
        };
        return newLogs;
      }

      return [...prev, {
        id: generateUUID(),
        message: cleanedMessage,
        type,
        timestamp: new Date().toLocaleTimeString(),
        event,
        data
      }];
    });
  };

  const launch = async (params: {
    apiConfig: ApiConfig;
    libId: string;
    seatNumber: string;
    cookieStr: string;
    opMode: "scheduled" | "immediate";
    execTime: "immediate" | "2148" | "custom";
    customTime: string;
    selectedSeatKey: string;
    roomName: string;
  }) => {
    const { apiConfig, libId, seatNumber, cookieStr, opMode, execTime, customTime, selectedSeatKey, roomName } = params;
    try {
      setLogs([]);
      setStatus("connecting");
      setCurrentPhase("idle");
      const newClientId = generateUUID();
      activeClientIdRef.current = newClientId;

      const timeStrDisplay = execTime === "immediate" ? "立即开始" : (execTime === "2148" ? "21:48:00" : customTime);
      const modeDisplay = opMode === "scheduled" ? "明日预约模式" : "立即抢座模式";

      addLog(`🚀 任务初始化...`, "info", "phase", { phase: "start" });
      addLog(`任务清单: 模式 [${modeDisplay}] | 场馆 [${roomName || "加载中"}] | 座位 [${seatNumber}] | 计划执行 [${timeStrDisplay}]`, "info", "phase");
      addLog("正在进行环境检查与身份校验...", "info");

      const mode = opMode === "immediate" ? 2 : 1;
      let timeStr = "";
      if (execTime === "2148") timeStr = "21:48:00";
      else if (execTime === "custom") timeStr = customTime;

      if (timeStr) {
        addLog(`计划执行时间: ${timeStr} (等待中...)`, "info", "countdown");
      }

      await submitRequest({
        clientId: newClientId,
        libId: parseInt(libId),
        seatNumber,
        mode,
        timeStr,
        cookieStr,
        seatKey: selectedSeatKey || undefined,
        apiUrl: apiConfig.apiUrl,
        origin: apiConfig.origin,
        referer: apiConfig.referer
      }, (message, event, data) => {
        const type = eventToLogType(event || "info");
        addLog(message, type, event, data);
      });

      setStatus("success");
      addLog("任务成功！座位已锁定。", "success", "success");
      setShowResultDialog(true);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "";
      const isCancelled = errMsg === "Task cancelled";
      setStatus(isCancelled ? "cancelled" : "failed");

      if (isCancelled) {
        addLog("任务已主动取消", "warning", "cancelled");
      } else {
        addLog(`任务失败: ${errMsg || "未知错误"}`, "error", "error");
      }
      setShowResultDialog(true);
    } finally {
      setStatus(prev => (prev === "connecting" || prev === "running") ? "idle" : prev);
    }
  };

  const stop = async () => {
    const id = activeClientIdRef.current;
    if (id) {
      await cancelTask(id);
      activeClientIdRef.current = null;
    }
    setStatus("cancelled");
    addLog("用户停止了任务", "warning", "cancelled");
    setShowResultDialog(true);
  };

  return {
    status, setStatus, logs, setLogs, latestLog, currentPhase,
    showResultDialog, setShowResultDialog, addLog, launch, stop,
  };
}
