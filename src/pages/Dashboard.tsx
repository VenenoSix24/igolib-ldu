import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, Calendar, Clock, Zap, Terminal, StopCircle, Info, CheckCircle, AlertTriangle,
  LayoutList, Eye, EyeOff, Activity, CheckCircle2, AlertCircle, Timer, Moon, Sun, Laptop, Trash2,
  KeyRound, Building2, Armchair, Settings, RefreshCw, X, QrCode
} from "lucide-react";
import { submitRequest, cancelTask, getDynamicRooms, getRoomSeats, validateUser, type RoomMapping, type DynamicRoom, type DynamicSeat } from "../services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { SettingsModal, loadApiConfig, saveApiConfig, type ApiConfig, DEFAULT_CONFIG } from "@/components/SettingsModal";
import { QRCodeCanvas } from "qrcode.react";
import { AuthService } from "../services/AuthService";

interface LogEntry {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: string;
  count?: number;
  event?: string;
  data?: Record<string, unknown>;
}

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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  // --- 全局数据 ---
  const [rooms, setRooms] = useState<RoomMapping>({});
  const [dynamicRooms, setDynamicRooms] = useState<DynamicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  // --- 座位数据 ---
  const [dynamicSeats, setDynamicSeats] = useState<DynamicSeat[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [seatInputMode, setSeatInputMode] = useState<'manual' | 'select'>('select');
  const [selectedSeatKey, setSelectedSeatKey] = useState<string>("");

  // --- API 配置状态 ---
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authInputUrl, setAuthInputUrl] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 加载 API 配置
  useEffect(() => {
    setApiConfig(loadApiConfig());
  }, []);

  // 保存 API 配置
  const handleSaveApiConfig = (config: ApiConfig) => {
    setApiConfig(config);
    saveApiConfig(config);
  };

  // 解析微信回调 URL 并自动填充 Cookie
  const handleAuthExchange = async () => {
    if (!authInputUrl) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cookie = await AuthService.exchangeCodeForCookie(authInputUrl);
      setCookieStr(cookie);
      addLog("🎉 身份 Cookie 已自动更新并保存", "success");
      setShowAuthDialog(false);
      setAuthInputUrl("");
      setAuthError(null);
    } catch (e: any) {
      const msg = e.message || String(e);
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  // --- 表单状态 ---
  const [libId, setLibId] = useState<string>("");
  const [seatNumber, setSeatNumber] = useState("");
  const [cookieStr, setCookieStr] = useState("");
  const [showCookie, setShowCookie] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; valid: boolean } | null>(null);
  const [validatingCookie, setValidatingCookie] = useState(false);

  // Cookie 验证
  useEffect(() => {
    setUserInfo(null);
    setValidatingCookie(false);

    async function checkCookie() {
      if (!cookieStr || cookieStr.trim().length < 10) {
        return;
      }
      setValidatingCookie(true);
      try {
        const res = await validateUser(cookieStr.trim(), apiConfig);
        if (res.valid) {
          setUserInfo({ name: res.name || "User", valid: true });
        } else {
          setUserInfo({ name: "", valid: false });
        }
      } catch (error) {
        setUserInfo({ name: "", valid: false });
      } finally {
        setValidatingCookie(false);
      }
    }
    const timer = setTimeout(checkCookie, 800);
    return () => clearTimeout(timer);
  }, [cookieStr, apiConfig]);

  // opMode: 执行模式(1=明日预约, 2=立即抢座)
  const [opMode, setOpMode] = useState<'scheduled' | 'immediate'>('scheduled');

  // execTime: 触发时间
  const [execTime, setExecTime] = useState<'immediate' | '2148' | 'custom'>('2148');
  const [customTime, setCustomTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().split(' ')[0]; // 返回 HH:MM:SS
  });

  // --- 控制台状态 ---
  const [status, setStatus] = useState<"idle" | "connecting" | "running" | "success" | "failed" | "cancelled">("idle");
  const activeClientIdRef = useRef<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [latestLog, setLatestLog] = useState<string>("就绪");
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // 任务阶段追踪
  const [currentPhase, setCurrentPhase] = useState<string>("idle");

  // --- 移动端状态 ---
  const [activeTab, setActiveTab] = useState<'config' | 'console'>('config');

  // --- 初始化与持久化 ---
  useEffect(() => {
    setLoadingRooms(false); // 不再加载静态数据

    // 恢复状态
    const savedCookie = localStorage.getItem("cookieStr"); if (savedCookie) setCookieStr(savedCookie);
    const savedLibId = localStorage.getItem("libId"); if (savedLibId) setLibId(savedLibId);
    const savedSeat = localStorage.getItem("seatNumber"); if (savedSeat) setSeatNumber(savedSeat);
    const savedOpMode = localStorage.getItem("opMode"); if (savedOpMode) setOpMode(savedOpMode as any);
    const savedExecTime = localStorage.getItem("execTime"); if (savedExecTime) setExecTime(savedExecTime as any);
    const savedTime = localStorage.getItem("customTime"); if (savedTime) setCustomTime(savedTime);

    return () => {
      // 组件卸载时终止所有活动任务
      if (activeClientIdRef.current) {
        cancelTask(activeClientIdRef.current);
        activeClientIdRef.current = null;
      }
    };
  }, []);

  // Cookie 变更时尝试动态刷新场馆列表
  useEffect(() => {
    // 依赖项变化时立即重置，避免显示旧 API 的数据
    setLoadingRooms(false);
    setRoomsError(null);
    setDynamicRooms([]);

    async function fetchDynamicRoomsData() {
      if (!cookieStr || cookieStr.trim().length < 10) {
        return;
      }

      setLoadingRooms(true);
      setRoomsError(null);

      try {
        const data = await getDynamicRooms(cookieStr.trim(), apiConfig);
        setDynamicRooms(data.rooms);

        const roomMapping: RoomMapping = {};
        data.rooms.forEach(room => {
          roomMapping[String(room.id)] = room.name;
        });
        setRooms(roomMapping);

        // 如果当前 libId 不在列表中，或者之前没选，就选第一个
        const exists = data.rooms?.some(r => String(r.id) === libId);
        if (!exists && data.rooms?.length > 0) {
          setLibId(String(data.rooms[0].id));
        } else if (data.rooms?.length === 0) {
          setLibId("");
        }

        console.log(`✅ 动态加载 ${data.rooms.length} 个场馆`);
      } catch (error) {
        console.warn("动态加载场馆失败，保持现状:", error);
        setRoomsError(error instanceof Error ? error.message : "加载失败");
      } finally {
        setLoadingRooms(false);
      }
    }

    const debounceTimer = setTimeout(fetchDynamicRoomsData, 500);
    return () => clearTimeout(debounceTimer);
  }, [cookieStr, apiConfig]); // 移除 libId 依赖，避免选择变更时重复请求

  useEffect(() => { localStorage.setItem("libId", libId); }, [libId]);
  useEffect(() => { localStorage.setItem("seatNumber", seatNumber); }, [seatNumber]);
  useEffect(() => { localStorage.setItem("cookieStr", cookieStr); }, [cookieStr]);
  useEffect(() => { localStorage.setItem("opMode", opMode); }, [opMode]);
  useEffect(() => { localStorage.setItem("execTime", execTime); }, [execTime]);
  useEffect(() => { localStorage.setItem("customTime", customTime); }, [customTime]);

  // 根据操作模式自动切换执行时间默认值
  useEffect(() => {
    if (opMode === 'scheduled') {
      // 明日预约模式 → 默认 21:48
      setExecTime('2148');
    } else {
      // 立即抢座模式 → 默认 立即
      setExecTime('immediate');
    }
  }, [opMode]);

  // 场馆变更时加载座位列表
  useEffect(() => {
    async function fetchSeatsForRoom() {
      // 需要有效的 Cookie 和 libId
      if (!cookieStr || cookieStr.trim().length < 10 || !libId) {
        setDynamicSeats([]);
        return;
      }

      setLoadingSeats(true);
      try {
        const data = await getRoomSeats(parseInt(libId), cookieStr.trim(), apiConfig);
        // 只保留可用座位用于选择
        const availableSeats = data.seats.filter(s => s.available);
        setDynamicSeats(availableSeats);
        // 如果当前选择的座位无效，重置
        if (selectedSeatKey && !availableSeats.find(s => s.key === selectedSeatKey)) {
          setSelectedSeatKey("");
        }
        console.log(`✅ 加载场馆 ${libId} 的 ${availableSeats.length} 个可用座位`);
      } catch (error) {
        console.warn("加载座位列表失败:", error);
        setDynamicSeats([]);
      } finally {
        setLoadingSeats(false);
      }
    }

    // 场馆切换后 300ms 加载座位
    const debounceTimer = setTimeout(fetchSeatsForRoom, 300);
    return () => clearTimeout(debounceTimer);
  }, [libId, cookieStr, apiConfig]); // 添加 apiConfig 依赖

  // 滚动日志
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // --- 逻辑 ---
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 200);
    return () => clearInterval(timer);
  }, []);

  const getTargetDate = () => {
    if (execTime === 'immediate') return null;

    let timeStr = "";
    if (execTime === '2148') timeStr = "21:48:00";
    else if (execTime === 'custom' && customTime) timeStr = customTime;

    if (!timeStr) return null;

    const [h, m, s] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(h || 0, m || 0, s || 0, 0);

    // 如果目标时间已过，则假设是明天的这个时间
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  };

  const targetDate = getTargetDate();

  const getCountDownString = () => {
    if (!targetDate) return null;
    const diff = targetDate.getTime() - now.getTime();
    if (diff < 0) return "00:00:00";

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const countDownStr = getCountDownString();

  // 缩短长状态消息以便在标题显示的辅助函数
  const formatStatusMessage = (msg: string) => {
    if (!msg) return "";
    // 针对 "不在预约时间" 错误的特定简化
    if (msg.includes("不在预约时间内")) {
      return "不在预约时间 (请在 21:48 后尝试)";
    }
    // 移除重复冗余前缀 (递归清理)
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

    // 如果仍然太长则截断
    if (cleanMsg.length > 30) {
      return cleanMsg.substring(0, 30) + "...";
    }
    return cleanMsg;
  };

  const updateStatus = (message: string) => {
    const cleaned = formatStatusMessage(message);
    setLatestLog(cleaned);
  };

  const addLog = (
    message: string,
    type: LogEntry["type"] = "info",
    event?: string,
    data?: Record<string, unknown>
  ) => {
    const cleanedMessage = (event === "result" || type === "error") ? formatStatusMessage(message) : message;
    updateStatus(cleanedMessage);

    // 根据事件类型更新当前阶段
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

      // 基于 event 类型的折叠：倒计时消息只更新最后一条
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

  // --- 任务控制逻辑 ---
  const handleStartRequest = async () => {
    if (!libId || !seatNumber || !cookieStr) return;
    setShowConfirm(true);
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const confirmAndLaunch = async () => {
    setShowConfirm(false);
    setActiveTab('console'); // 切换视图
    try {
      // 设置状态
      setLogs([]);
      setStatus("connecting");
      setCurrentPhase("idle");
      const newClientId = generateUUID();
      activeClientIdRef.current = newClientId;

      // --- 任务启动日志 ---
      const timeStrDisplay = execTime === 'immediate' ? "立即开始" : (execTime === '2148' ? "21:48:00" : customTime);
      const modeDisplay = opMode === 'scheduled' ? "明日预约模式" : "立即抢座模式";

      addLog(`🚀 任务初始化...`, "info", "phase", { phase: "start" });
      addLog(`任务清单: 模式 [${modeDisplay}] | 场馆 [${rooms[libId] || '加载中'}] | 座位 [${seatNumber}] | 计划执行 [${timeStrDisplay}]`, "info", "phase");
      addLog("正在进行环境检查与身份校验...", "info");

      // 准备参数
      const mode = opMode === 'immediate' ? 2 : 1;
      let timeStr = "";
      if (execTime === '2148') timeStr = "21:48:00";
      else if (execTime === 'custom') timeStr = customTime;

      if (timeStr) {
        addLog(`计划执行时间: ${timeStr} (等待中...)`, "info", "countdown");
      }

      // 直接调用 API
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
        // 状态更新回调
        const type = eventToLogType(event || "info");
        addLog(message, type, event, data);
      });

      // 成功处理
      setStatus("success");
      addLog("任务成功！座位已锁定。", "success", "success");
      setShowResultDialog(true);

    } catch (error: any) {
      // 失败处理
      const isCancelled = error.message === "Task cancelled";
      setStatus(isCancelled ? "cancelled" : "failed");
      const errorMsg = error.message || "未知错误";

      if (isCancelled) {
        addLog("任务已主动取消", "warning", "cancelled");
      } else {
        addLog(`任务失败: ${errorMsg}`, "error", "error");
      }
      setShowResultDialog(true);
    } finally {
      // 只有在没有进入 success/failed/cancelled 状态时才重置为 idle
      // 使用函数式更新来检查最新状态
      setStatus(prev => (prev === 'connecting' || prev === 'running') ? 'idle' : prev);
    }
  };

  const handleStop = async () => {
    const id = activeClientIdRef.current;
    if (id) {
      await cancelTask(id);
      activeClientIdRef.current = null;
    }
    setStatus("cancelled");
    addLog("用户停止了任务", "warning", "cancelled");
    setShowResultDialog(true);
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-slate-50/85 dark:bg-neutral-950/85 flex flex-col font-sans overflow-hidden transition-colors duration-300">


      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">

        {/* ---------------- 左侧栏: 配置 ---------------- */}
        <div className={cn(
          "w-full lg:w-[30%] bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800 transition-transform lg:translate-x-0 h-full flex flex-col",
          activeTab === 'config' ? "flex" : "hidden lg:flex"
        )}>
          <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8 custom-scrollbar flex flex-col min-h-0">
            <div className="pb-4 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center mb-3 pt-[calc(env(safe-area-inset-top)+1rem)] lg:pt-4">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Rocket className="w-5 h-5 text-blue-500" />
                任务配置
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cycleTheme}
                  className="w-9 h-9 text-slate-500 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-slate-100"
                  title={theme === 'system' ? "跟随系统" : (theme === 'dark' ? "深色模式" : "浅色模式")}
                >
                  {theme === "dark" ? <Moon className="w-5 h-5" /> :
                    theme === "light" ? <Sun className="w-5 h-5" /> :
                      <Laptop className="w-5 h-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(true)}
                  className="w-9 h-9 text-slate-500 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-slate-100"
                  title="API 设置"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <form className="flex-1 flex flex-col justify-start gap-5 max-w-lg mx-auto w-full min-h-0 overflow-y-auto py-2 custom-scrollbar pt-4" onSubmit={(e) => e.preventDefault()}>

              {/* 1. 操作模式 */}
              <div className="space-y-3 shrink-0">
                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <LayoutList className="w-3 h-3" /> 操作模式
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOpMode('scheduled')}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex flex-col items-center gap-1",
                      opMode === 'scheduled'
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-400"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    明日预约
                  </button>
                  <button
                    onClick={() => setOpMode('immediate')}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 flex flex-col items-center gap-1",
                      opMode === 'immediate'
                        ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-400"
                    )}
                  >
                    <Zap className="w-4 h-4" />
                    立即抢座
                  </button>
                </div>
              </div>

              {/* 2. 身份 (Cookie) */}
              <div className="space-y-3 shrink-0">
                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-2"><KeyRound className="w-3 h-3" /> 身份 Cookie</span>
                  {validatingCookie && <span className="text-[10px] text-blue-500 animate-pulse">验证中...</span>}
                  {!validatingCookie && userInfo?.valid && <span className="text-[10px] text-green-500 font-normal">已验证: {userInfo.name}</span>}
                  {!validatingCookie && userInfo && !userInfo.valid && <span className="text-[10px] text-red-500 font-normal">Cookie 无效</span>}
                </Label>
                <div className="relative">
                  <Input
                    type={showCookie ? "text" : "password"}
                    placeholder="粘贴 Cookie 或使用扫码获取..."
                    value={cookieStr}
                    onChange={(e) => setCookieStr(e.target.value)}
                    autoComplete="off"
                    className={cn(
                      "pr-10 h-10 font-mono text-sm transition-colors dark:bg-[rgb(16,16,16)] dark:border-neutral-700",
                      userInfo?.valid ? "border-green-500 focus-visible:ring-green-500 bg-green-50/10" :
                        (userInfo && !userInfo.valid ? "border-red-500 focus-visible:ring-red-500 bg-red-50/10" : "bg-slate-50 border-slate-200")
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookie(!showCookie)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-neutral-600 p-1"
                  >
                    {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuthDialog(true)}
                  className="text-[11px] text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  <QrCode className="w-3 h-3" />
                  没有 Cookie？点击扫码获取吧
                </button>
              </div>

              {/* 3. 执行详情 */}
              <div className="space-y-5 pt-4 border-t border-slate-100 dark:border-neutral-800">
                {/* 时间 */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Clock className="w-3 h-3" /> 执行时间
                  </Label>
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-neutral-800 rounded-lg">
                    {['immediate', '2148', 'custom'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setExecTime(t as any)}
                        className={cn(
                          "flex-1 py-1.5 px-2 rounded-md text-xs font-bold transition-all capitalize",
                          execTime === t
                            ? "bg-white dark:bg-neutral-600 text-blue-600 dark:text-blue-300 shadow-sm"
                            : "text-slate-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200"
                        )}
                      >
                        {t === 'immediate' ? '立即' : t === '2148' ? '21:48' : '自定义'}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {execTime === 'custom' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <Input
                          type="time"
                          step="1"
                          value={customTime}
                          onChange={(e) => setCustomTime(e.target.value)}
                          className="text-center font-mono bg-blue-50/50 border-blue-100 text-blue-700 dark:bg-blue-900/10 dark:border-blue-800 dark:text-blue-300"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 阅览室与座位 */}
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2">
                      <Building2 className="w-3 h-3" /> 阅览室
                      {dynamicRooms.length > 0 && !roomsError && (
                        <span className="text-green-500 text-[10px] font-normal">✓ 实时</span>
                      )}
                    </Label>
                    <select
                      className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[rgb(16,16,16)] dark:border-neutral-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      value={libId}
                      onChange={(e) => setLibId(e.target.value)}
                      disabled={loadingRooms || dynamicRooms.length === 0}
                    >
                      {loadingRooms ? (
                        <option>正在获取最新馆藏数据...</option>
                      ) : dynamicRooms.length > 0 ? (
                        dynamicRooms
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name} ({room.seatsAvailable}座可用)
                            </option>
                          ))
                      ) : (
                        <option value="">{cookieStr ? "未找到可用场馆" : "请先输入有效 Cookie"}</option>
                      )}
                    </select>
                    {roomsError && (
                      <p className="text-xs text-amber-500">{roomsError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-500 font-bold uppercase flex items-center gap-2">
                        <Armchair className="w-3 h-3" /> 座位号
                        {dynamicSeats.length > 0 && !roomsError && (
                          <span className="text-green-500 text-[10px] font-normal">({dynamicSeats.length}可用)</span>
                        )}
                      </Label>
                      {/* 模式切换按钮 */}
                      {dynamicSeats.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSeatInputMode(seatInputMode === 'manual' ? 'select' : 'manual');
                            // 切换模式时同步数据
                            if (seatInputMode === 'select' && selectedSeatKey) {
                              const seat = dynamicSeats.find(s => s.key === selectedSeatKey);
                              if (seat) setSeatNumber(seat.name);
                            }
                          }}
                          className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                        >
                          {seatInputMode === 'manual' ? '选择座位 →' : '← 手动输入'}
                        </button>
                      )}
                    </div>

                    {seatInputMode === 'manual' || dynamicSeats.length === 0 ? (
                      // 手动输入模式
                      <Input
                        placeholder="001"
                        value={seatNumber}
                        onChange={(e) => setSeatNumber(e.target.value)}
                        autoComplete="off"
                        className="h-10 font-mono text-center tracking-widest dark:bg-[rgb(16,16,16)] dark:border-neutral-700"
                      />
                    ) : (
                      // 下拉选择模式
                      <select
                        className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[rgb(16,16,16)] dark:border-neutral-700 dark:text-white font-mono"
                        value={selectedSeatKey}
                        onChange={(e) => {
                          setSelectedSeatKey(e.target.value);
                          // 同时更新 seatNumber
                          const seat = dynamicSeats.find(s => s.key === e.target.value);
                          if (seat) setSeatNumber(seat.name);
                        }}
                        disabled={loadingSeats}
                      >
                        {loadingSeats ? (
                          <option>加载中...</option>
                        ) : (
                          <>
                            <option value="">选择座位...</option>
                            {dynamicSeats
                              .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
                              .map((seat) => (
                                <option key={seat.key} value={seat.key}>
                                  {seat.name}
                                </option>
                              ))}
                          </>
                        )}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {/* 启动/终止按钮 - 桌面端合为一个 */}
            <div className="shrink-0 pt-2 pb-20 lg:pb-0 max-w-lg mx-auto w-full px-4 md:px-0">
              {(status === 'running' || status === 'connecting') ? (
                // 桌面端正在运行或连接时显示终止按钮
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-red-500/20 hidden lg:flex items-center justify-center"
                >
                  <StopCircle className="w-5 h-5 mr-2" /> 终止任务
                </Button>
              ) : (
                // 启动按钮 - 非运行状态时显示
                <Button
                  className={cn(
                    "w-full h-12 mb-4 text-lg font-bold rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                    // 已经通过外层判断控制了显示，此处保留原有样式类
                  )}
                  onClick={handleStartRequest}
                  disabled={loadingRooms}
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  启动任务
                </Button>
              )}
            </div>
          </div>
        </div>


        {/* ---------------- 右侧栏: 控制台 ---------------- */}
        <div className={cn(
          "w-full lg:w-[70%] bg-slate-50 dark:bg-black relative flex flex-col h-full overflow-hidden transition-transform",
          activeTab === 'console' ? "flex" : "hidden lg:flex"
        )}>
          {/* 头部 */}
          <div className="shrink-0 pt-[calc(env(safe-area-inset-top)+1rem)] lg:pt-6 p-4 md:p-6 bg-white/80 dark:bg-[rgb(23,23,23)] backdrop-blur-sm border-b border-slate-200 dark:border-neutral-800 shadow-sm z-10 transition-colors duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3 h-3" /> 任务进度
              </h3>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-mono", (status === 'running' || status === 'connecting') ? "text-green-500" : "text-slate-300")}>
                  {(status === 'running' || status === 'connecting') ? "● 系统在线" : "○ 已准备就绪"}
                </span>
              </div>
            </div>
            {/* 任务阶段时间线 */}
            {(status !== 'idle') && (
              <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* 桌面端：横向时间线 */}
                <div className="hidden md:flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl">
                  {[
                    { key: "waiting", label: "等待中", icon: Timer },
                    { key: "countdown", label: "倒计时", icon: Clock },
                    { key: "queuing", label: "排队", icon: Activity },
                    { key: "reserving", label: "预约", icon: Rocket },
                    {
                      key: "done",
                      label: currentPhase === 'failed' ? "失败" : (currentPhase === 'cancelled' ? "取消" : "完成"),
                      icon: currentPhase === 'failed' ? AlertCircle : (currentPhase === 'cancelled' ? AlertTriangle : CheckCircle2)
                    }
                  ].map((step, idx, arr) => {
                    const isTerminal = currentPhase === 'done' || currentPhase === 'failed' || currentPhase === 'cancelled';
                    const isActive = currentPhase === step.key;

                    const isLastStep = idx === arr.length - 1;
                    const finalIsActive = isActive || (isLastStep && isTerminal);

                    const isPast = !isTerminal && arr.findIndex(s => s.key === currentPhase) > idx;

                    const Icon = step.icon;

                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                          finalIsActive && !isTerminal && "bg-blue-500 text-white shadow-lg shadow-blue-500/30",
                          finalIsActive && currentPhase === 'done' && "bg-green-500 text-white shadow-lg shadow-green-500/30",
                          finalIsActive && currentPhase === 'failed' && "bg-red-500 text-white shadow-lg shadow-red-500/30",
                          finalIsActive && currentPhase === 'cancelled' && "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
                          isPast && "bg-slate-200 dark:bg-neutral-700 text-slate-400",
                          !finalIsActive && !isPast && "text-slate-400 dark:text-neutral-500"
                        )}>
                          <Icon className={cn("w-3.5 h-3.5", isActive && !isTerminal && "animate-pulse")} />
                          <span className="hidden lg:inline">{step.label}</span>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={cn(
                            "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                            isPast || isTerminal ? (currentPhase === 'failed' ? "bg-red-400" : currentPhase === 'cancelled' ? "bg-amber-400" : "bg-green-400") : "bg-slate-200 dark:bg-neutral-700"
                          )} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 移动端：紧凑显示当前阶段 */}
                <div className="md:hidden flex items-center justify-center gap-3 p-3 bg-slate-50 dark:bg-neutral-800/50 rounded-xl">
                  {(() => {
                    const phaseMap: Record<string, { label: string; color: string; dot: string }> = {
                      idle: { label: "就绪", color: "text-slate-500", dot: "bg-slate-500" },
                      waiting: { label: "等待执行", color: "text-blue-500", dot: "bg-blue-500" },
                      countdown: { label: "倒计时中", color: "text-cyan-500", dot: "bg-cyan-500" },
                      queuing: { label: "正在排队", color: "text-purple-500", dot: "bg-purple-500" },
                      reserving: { label: "正在预约", color: "text-blue-500", dot: "bg-blue-500" },
                      executing: { label: "执行中", color: "text-orange-500", dot: "bg-orange-500" },
                      start: { label: "开始", color: "text-blue-500", dot: "bg-blue-500" },
                      done: { label: "任务完成", color: "text-green-500", dot: "bg-green-500" },
                      failed: { label: "任务失败", color: "text-red-500", dot: "bg-red-500" },
                      cancelled: { label: "任务已取消", color: "text-amber-500", dot: "bg-amber-500" }
                    };
                    const phase = phaseMap[currentPhase] || { label: currentPhase, color: "text-slate-500", dot: "bg-slate-500" };
                    const isTerminal = ["done", "failed", "cancelled"].includes(currentPhase);

                    return (
                      <>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          !isTerminal && "animate-pulse",
                          phase.dot
                        )} />
                        <span className={cn("text-sm font-bold", phase.color)}>{phase.label}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 实时倒计时显示 */}
            {countDownStr && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-100 dark:border-neutral-700 flex justify-between items-center animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>距离计划执行</span>
                </div>
                <div className="font-mono text-xl font-black text-neutral-700 dark:text-slate-200 tracking-widest tabular-nums">
                  {countDownStr}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                status === 'running' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                  status === 'success' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                    status === 'failed' ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-slate-100 text-slate-400 dark:bg-neutral-800"
              )}>
                {status === 'running' ? <Timer className="w-6 h-6 animate-pulse" /> :
                  status === 'success' ? <CheckCircle2 className="w-6 h-6" /> :
                    status === 'failed' ? <AlertCircle className="w-6 h-6" /> :
                      <Terminal className="w-6 h-6" />}
              </div>
              <div>
                <div className="text-xl md:text-2xl font-black text-neutral-800 dark:text-slate-100 tracking-tight leading-none break-all line-clamp-2">
                  {formatStatusMessage(latestLog)}
                </div>
                {status === 'running' && (
                  <p className="text-xs text-blue-500 font-bold mt-1 animate-pulse">正在执行任务逻辑...</p>
                )}
              </div>
              <Button size="icon" variant="ghost" className="ml-auto text-slate-400 hover:text-neutral-600" onClick={() => setLogs([])} title="清空日志">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

          </div>

          {/* 可滚动日志 */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 space-y-3 font-mono text-sm bg-slate-50 dark:bg-[rgb(16,16,16)]">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30">
                <div className="text-6xl grayscale mb-4">☕️</div>
                <p className="text-slate-400 dark:text-neutral-600 font-medium">Ready when you are</p>
              </div>
            ) : (
              <div className="pb-10 space-y-3">
                <AnimatePresence initial={false}>
                  {logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="w-full"
                    >
                      {/* 基于 event 类型的日志行样式 */}
                      <div className={cn(
                        "flex items-start gap-3 py-2.5 px-4 rounded-lg border-l-3 transition-all hover:bg-black/5 dark:hover:bg-white/5",
                        // 成功
                        log.event === "success" && "border-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-900/20 text-green-700 dark:text-green-300",
                        // 错误
                        log.event === "error" && "border-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-900/20 text-red-700 dark:text-red-300",
                        // 警告 / 取消
                        (log.event === "warning" || log.event === "cancelled") && "border-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-900/20 text-amber-700 dark:text-amber-300",
                        // 倒计时
                        log.event === "countdown" && "border-cyan-400 bg-gradient-to-r from-cyan-50/30 to-transparent dark:from-cyan-900/10 text-cyan-700 dark:text-cyan-300",
                        // 阶段进度 (任务清单等)
                        log.event === "phase" && "border-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold",
                        // 重试
                        log.event === "retry" && "border-orange-400 bg-gradient-to-r from-orange-50/40 to-transparent dark:from-orange-900/15 text-orange-700 dark:text-orange-300",
                        // 默认
                        (!log.event || log.event === "info") && "border-slate-300 dark:border-neutral-600 text-neutral-600 dark:text-slate-400"
                      )}>
                        <span className="hidden sm:block shrink-0 font-mono text-[10px] opacity-40 w-[50px] pt-1 select-none text-right">
                          {log.timestamp.split(' ')[0]}
                        </span>

                        <div className="shrink-0 pt-0.5">
                          {log.event === 'success' ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                            log.event === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                              (log.event === 'warning' || log.event === 'cancelled') ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
                                log.event === 'countdown' ? <Timer className="w-4 h-4 text-cyan-500 animate-pulse" /> :
                                  log.event === 'phase' ? <Zap className="w-4 h-4 text-blue-500" /> :
                                    log.event === 'retry' ? <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" /> :
                                      <Info className="w-4 h-4 opacity-50" />}
                        </div>

                        <span className="flex-1 text-[13px] sm:text-sm font-medium leading-relaxed break-words font-sans">
                          {log.message}
                          {log.count && log.count > 1 && (
                            <span className="ml-2 inline-flex items-center justify-center bg-slate-200/80 dark:bg-neutral-700/80 text-neutral-600 dark:text-slate-300 h-5 px-2 rounded-full text-[10px] font-bold">
                              ×{log.count}
                            </span>
                          )}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={logEndRef} />
              </div>
            )}
          </div>

          {/* 底部操作 - 移动端进行中显示终止按钮 */}
          {(status === 'running' || status === 'connecting') && (
            <div className="shrink-0 pt-0 pb-32 px-4 backdrop-blur-sm z-20 lg:hidden">
              <Button
                variant="destructive"
                onClick={handleStop}
                className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-red-500/20"
              >
                <StopCircle className="w-5 h-5 mr-2" /> 终止任务
              </Button>
            </div>
          )}
          {/* 移动端任务结束或空闲时显示返回配置按钮 */}
          {(status !== 'idle' && status !== 'running' && status !== 'connecting') && (
            <div className="shrink-0 pt-0 pb-32 px-4 backdrop-blur-sm shadow-xl z-20 lg:hidden">
              <Button
                onClick={() => setActiveTab('config')}
                className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98]"
              >
                <LayoutList className="w-5 h-5 mr-2" /> 返回配置
              </Button>
            </div>
          )}
        </div>
      </div >

      {/* 确认对话框 */}
      < Dialog open={showConfirm} onOpenChange={setShowConfirm} >
        <DialogContent className="bg-white dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 shadow-2xl">
          {/* ... 对话框内容  ... */}
          <DialogHeader>
            <DialogTitle>确认启动任务</DialogTitle>
            <DialogDescription>请确认以下配置信息无误</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 dark:bg-neutral-900 p-4 rounded-lg space-y-3 text-sm border dark:border-neutral-800">
            <div className="flex justify-between">
              <span className="text-slate-500">操作模式</span>
              <span className="font-bold dark:text-slate-200">
                {opMode === 'immediate' ? "立即抢座" : "明日预约"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">触发时间</span>
              <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                {execTime === 'immediate' ? "现在 (Now)" : (execTime === '2148' ? "21:48:00" : customTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">阅览室</span>
              <span className="font-bold max-w-[200px] truncate block text-right dark:text-slate-200">{rooms[libId]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">座位号</span>
              <span className="font-bold font-mono dark:text-slate-200">{seatNumber}</span>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>取消</Button>
            <Button onClick={confirmAndLaunch} className="bg-blue-600 hover:bg-blue-700 text-white">确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* 设置弹窗 */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={apiConfig}
        onSave={handleSaveApiConfig}
      />

      {/* 微信扫码授权弹窗 */}
      <AnimatePresence>
        {showAuthDialog && (
          <>
            {/* 遮罩层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowAuthDialog(false)}
            />

            {/* 弹窗主体 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{ x: "-50%", y: "-50%" }}
              className="fixed left-1/2 top-1/2 w-[90%] max-w-sm bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl z-50 overflow-hidden border dark:border-neutral-800"
            >
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-neutral-800">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-500" />
                  扫码获取 Cookie
                </h2>
                <button
                  onClick={() => setShowAuthDialog(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* 内容 */}
              <div className="p-5 space-y-5">
                {/* 步骤 1: 扫码 */}
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

                {/* 步骤 2: 粘贴链接 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">粘贴复制的回调链接</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://.../?code=..."
                      value={authInputUrl}
                      onChange={(e) => setAuthInputUrl(e.target.value)}
                      className="flex-1 text-xs font-mono dark:bg-[rgb(16,16,16)] dark:border-neutral-700"
                    />
                    <Button
                      size="sm"
                      onClick={handleAuthExchange}
                      disabled={authLoading || !authInputUrl}
                      className="min-w-[64px]"
                    >
                      {authLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : "解析"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 错误提示 */}
              {authError && (
                <div className="mx-5 mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {authError}
                  </p>
                </div>
              )}

              {/* 底部 */}
              <div className="px-5 py-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
                <p className="text-[10px] text-slate-400 text-center">
                  链接仅用于本地解析 Code，不会向第三方上传
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 结果弹窗 */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="w-[90%] max-w-[340px] rounded-2xl p-4 sm:p-6 bg-white dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 shadow-2xl" aria-describedby={undefined}>
          {/* 无障碍：隐藏的标题 */}
          <DialogHeader className="sr-only">
            <DialogTitle>
              {status === 'success' ? "任务成功" : status === 'cancelled' ? "任务已取消" : "任务失败"}
            </DialogTitle>
          </DialogHeader>

          {/* 居中的内容区域 */}
          <div className="flex flex-col items-center pt-2 pb-1">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center mb-3 shadow-inner",
                status === 'success' && "bg-green-100 dark:bg-green-900/30 text-green-600",
                status === 'failed' && "bg-red-100 dark:bg-red-900/30 text-red-600",
                status === 'cancelled' && "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
              )}
            >
              {status === 'success' ? <CheckCircle2 className="w-7 h-7" /> :
                status === 'cancelled' ? <StopCircle className="w-7 h-7" /> :
                  <AlertCircle className="w-7 h-7" />}
            </motion.div>

            <h2 className={cn(
              "text-lg font-bold text-center tracking-tight",
              status === 'success' && "text-green-700 dark:text-green-300",
              status === 'failed' && "text-red-700 dark:text-red-300",
              status === 'cancelled' && "text-amber-700 dark:text-amber-300"
            )}>
              {status === 'success' ? "🎉 任务成功！" :
                status === 'cancelled' ? "任务已取消" :
                  "任务失败"}
            </h2>

            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 text-center mt-1.5 px-2 leading-relaxed">
              {status === 'success' ? "座位预约成功，请按时到馆" :
                status === 'cancelled' ? "任务已被用户主动取消" :
                  latestLog}
            </p>
          </div>

          {/* 成功时显示座位信息 */}
          {status === 'success' && (
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-xl mt-1">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-400">场馆</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                    {rooms[libId] || '阅览室'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-slate-400">座位</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{seatNumber} 号</span>
                </div>
              </div>
            </div>
          )}

          {/* 失败时显示改进建议 */}
          {status === 'failed' && (
            <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-3 rounded-xl mt-1">
              <p className="text-red-600 dark:text-red-400 text-[12px] text-center font-medium">
                {latestLog.includes('Cookie') ? '💡 请更新 Cookie 后重试' : '💡 请检查网络或配置后重试'}
              </p>
            </div>
          )}

          <DialogFooter className="mt-4 sm:mt-5">
            <Button
              onClick={() => setShowResultDialog(false)}
              className={cn(
                "w-full h-10 font-bold rounded-xl transition-all active:scale-[0.97]",
                status === 'success' && "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20",
                status === 'failed' && "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20",
                status === 'cancelled' && "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
              )}
            >
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动端底部导航栏 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-neutral-800 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] flex justify-around items-center z-40">
        <button
          onClick={() => setActiveTab('config')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'config' ? "text-blue-500 scale-110" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'config' && "bg-blue-50 dark:bg-blue-900/20")}>
            <Settings className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold">配置</span>
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'console' ? "text-blue-500 scale-110" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'console' && "bg-blue-50 dark:bg-blue-900/20")}>
            <Activity className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold">状态</span>
        </button>
      </div>
    </div >
  );
}
