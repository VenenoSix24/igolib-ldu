import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, Calendar, Clock, Zap, Terminal, StopCircle, Info, CheckCircle, AlertTriangle,
  LayoutList, Eye, EyeOff, Activity, CheckCircle2, AlertCircle, Timer, Moon, Sun, Laptop, Trash2
} from "lucide-react";
import { getMappings, submitRequest, cancelTask, type RoomMapping } from "../services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

interface LogEntry {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: string;
  count?: number;
}


// 适用于非安全上下文 (HTTP) 的 UUID 生成辅助函数
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
  const [loadingRooms, setLoadingRooms] = useState(true);

  // --- 表单状态 ---
  const [libId, setLibId] = useState<string>("");
  const [seatNumber, setSeatNumber] = useState("");
  const [cookieStr, setCookieStr] = useState("");
  const [showCookie, setShowCookie] = useState(false);

  // 解耦逻辑:
  // opMode: 执行什么动作？(1=明日预约, 2=立即抢座)
  const [opMode, setOpMode] = useState<'scheduled' | 'immediate'>('scheduled');

  // execTime: 何时触发？
  const [execTime, setExecTime] = useState<'immediate' | '2148' | 'custom'>('2148');
  const [customTime, setCustomTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().split(' ')[0]; // 返回 HH:MM:SS
  });

  // --- 控制台状态 ---
  const [status, setStatus] = useState<"idle" | "connecting" | "running" | "success" | "failed" | "cancelled">("idle");
  const [clientId, setClientId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [latestLog, setLatestLog] = useState<string>("就绪");
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // --- 移动端状态 ---
  const [activeTab, setActiveTab] = useState<'config' | 'console'>('config');

  // --- 初始化与持久化 ---
  useEffect(() => {
    async function fetchRooms() {
      try {
        const data = await getMappings();
        setRooms(data.rooms);
        const ids = Object.keys(data.rooms);
        if (ids.length > 0 && !localStorage.getItem("libId")) {
          setLibId(ids[0]);
        }
      } catch (error) {
        console.error("加载阅览室失败:", error);
      } finally {
        setLoadingRooms(false);
      }
    }
    fetchRooms();

    // 恢复状态
    const savedCookie = localStorage.getItem("cookieStr"); if (savedCookie) setCookieStr(savedCookie);
    const savedLibId = localStorage.getItem("libId"); if (savedLibId) setLibId(savedLibId);
    const savedSeat = localStorage.getItem("seatNumber"); if (savedSeat) setSeatNumber(savedSeat);
    const savedOpMode = localStorage.getItem("opMode"); if (savedOpMode) setOpMode(savedOpMode as any);
    const savedExecTime = localStorage.getItem("execTime"); if (savedExecTime) setExecTime(savedExecTime as any);
    const savedTime = localStorage.getItem("customTime"); if (savedTime) setCustomTime(savedTime);
  }, []);

  useEffect(() => { localStorage.setItem("libId", libId); }, [libId]);
  useEffect(() => { localStorage.setItem("seatNumber", seatNumber); }, [seatNumber]);
  useEffect(() => { localStorage.setItem("cookieStr", cookieStr); }, [cookieStr]);
  useEffect(() => { localStorage.setItem("opMode", opMode); }, [opMode]);
  useEffect(() => { localStorage.setItem("execTime", execTime); }, [execTime]);
  useEffect(() => { localStorage.setItem("customTime", customTime); }, [customTime]);

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
    // 移除常见前缀
    let cleanMsg = msg.replace(/^操作失败: /, "").replace(/^执行结果: /, "").replace(/^状态更新: /, "");

    // 如果仍然太长则截断
    if (cleanMsg.length > 20) {
      return cleanMsg.substring(0, 20) + "...";
    }
    return cleanMsg;
  };

  const updateStatus = (message: string) => {
    setLatestLog(message);
  };

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    // 过滤干扰信息
    const noisePatterns = ["===", "---", "步骤", "响应:", "Async", "Check", "通道"];
    const isNoise = noisePatterns.some(p => message.includes(p));
    // 即使部分匹配干扰模式，也始终显示重要状态、错误或成功信息
    const isImportant = type === 'error' || type === 'success' || message.includes("Access Denied") || message.includes("开始执行");

    if (isNoise && !isImportant) return;

    updateStatus(message);
    setLogs(prev => {
      const lastLog = prev[prev.length - 1];
      // 重复倒计时的折叠逻辑
      const isCountdown = message.includes("距离计划执行时间") || message.includes("挂起中");

      if (lastLog && isCountdown && lastLog.message.split(' ')[0] === message.split(' ')[0]) {
        const newLogs = [...prev];
        newLogs[newLogs.length - 1] = {
          ...lastLog,
          message: message,
          timestamp: new Date().toLocaleTimeString(),
          count: (lastLog.count || 1) + 1
        };
        return newLogs;
      }

      return [...prev, {
        id: generateUUID(),
        message,
        type,
        timestamp: new Date().toLocaleTimeString()
      }];
    });
  };

  const handleStartRequest = () => {
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
    setActiveTab('console'); // Switch view

    // 1. 完全清除之前的状态
    setLogs([]);
    setLatestLog("正在初始化...");
    setStatus("connecting");

    const newClientId = generateUUID();
    setClientId(newClientId);

    // 2. 首先连接 WebSocket (修复竞态条件)
    // 使用 window.location.host 可以正确处理开发和生产环境 (包括代理)。
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/${newClientId}`;

    addLog(`正在连接服务器通道 (${window.location.host})...`, "info");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // 等待连接的 Promise 包装器
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("连接服务器超时 (5s)"));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      ws.onerror = (_) => {
        clearTimeout(timeout);
        // 在 JS 中很难从 WS 事件获取详细错误信息
        reject(new Error("WebSocket 连接失败"));
      };
    });

    try {
      await connectionPromise;
      setStatus("running");
      addLog("控制通道已建立", "success");

      // 设置监听器
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "status") {
            addLog(data.message, "info");
          } else if (data.type === "result") {
            if (data.status === "success") {
              setStatus("success");
              addLog(data.message, "success");
            } else {
              setStatus("failed");
              addLog(data.message, "error");
            }
          }
        } catch {
          addLog(event.data, "info");
        }
      };

      ws.onclose = () => {
        // 仅当我们未主动关闭时才警告 (状态非已取消)
        setClientId(currentId => {
          if (currentId === newClientId) { // 检查是否仍为活动会话
            // 此处的日志可能重复，但便于调试
          }
          return currentId;
        });
      };

      // 3. 连接建立后提交请求
      // opMode 决定动作类型 (1=预约, 2=抢座)
      let mode = opMode === 'immediate' ? 2 : 1;
      let timeStr = "";
      if (execTime === '2148') timeStr = "21:48:00";
      else if (execTime === 'custom') timeStr = customTime;

      addLog("正在下发任务指令...", "info");

      await submitRequest({
        clientId: newClientId,
        libId: parseInt(libId),
        seatNumber,
        mode,
        timeStr,
        cookieStr
      });

      // 此后立即通过 WS 处理用户反馈
      addLog("任务指令已接收", "success");

    } catch (error) {
      setStatus("failed");
      addLog(`启动失败: ${error instanceof Error ? error.message : "未知错误"}`, "error");
      // 失败时清理
      ws.close();
    }
  };

  const handleStop = async () => {
    if (!clientId) return;
    try {
      await cancelTask(clientId);
      setStatus("cancelled");
      addLog("正在请求终止...", "warning");
    } catch (error) {
      addLog("终止请求失败", "error");
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 flex flex-col font-sans overflow-hidden transition-colors duration-300">

      {/* 移动端标签切换器 (Flex Item, Naturally Fixed at Top) */}
      <div className="lg:hidden flex border-b bg-white dark:bg-slate-900 shrink-0 shadow-sm">
        <button
          onClick={() => setActiveTab('config')}
          className={cn("flex-1 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'config' ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500")}
        >
          配置
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={cn("flex-1 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'console' ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500")}
        >
          状态
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">

        {/* ---------------- 左侧栏: 配置 ---------------- */}
        <div className={cn(
          "w-full lg:w-[40%] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform lg:translate-x-0 h-full relative flex flex-col",
          activeTab === 'config' ? "block" : "hidden lg:block"
        )}>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:pb-24 custom-scrollbar flex flex-col">
            <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Rocket className="w-5 h-5 text-blue-500" />
                任务配置
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                title={theme === 'system' ? "跟随系统" : (theme === 'dark' ? "深色模式" : "浅色模式")}
              >
                {theme === "dark" ? <Moon className="w-5 h-5" /> :
                  theme === "light" ? <Sun className="w-5 h-5" /> :
                    <Laptop className="w-5 h-5" />}
              </Button>
            </div>

            <form className="flex-1 flex flex-col justify-center min-h-0 gap-4 sm:gap-6 lg:gap-8 pb-4" onSubmit={(e) => e.preventDefault()}>

              {/* 1. 操作模式 */}
              <div className="space-y-3">
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
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
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
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    )}
                  >
                    <Zap className="w-4 h-4" />
                    立即抢座
                  </button>
                </div>
              </div>

              {/* 2. 身份 (Cookie) */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  身份 Cookie
                </Label>
                <div className="relative">
                  <Input
                    type={showCookie ? "text" : "password"}
                    placeholder="粘贴 JSESSIONID..."
                    value={cookieStr}
                    onChange={(e) => setCookieStr(e.target.value)}
                    className="pr-10 h-10 font-mono text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors dark:bg-slate-950 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookie(!showCookie)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 3. 执行详情 */}
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                {/* 时间 */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Clock className="w-3 h-3" /> 执行时间
                  </Label>
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {['immediate', '2148', 'custom'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setExecTime(t as any)}
                        className={cn(
                          "flex-1 py-1.5 px-2 rounded-md text-xs font-bold transition-all capitalize",
                          execTime === t
                            ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500 font-bold uppercase">阅览室</Label>
                    <select
                      className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                      value={libId}
                      onChange={(e) => setLibId(e.target.value)}
                      disabled={loadingRooms}
                    >
                      {loadingRooms ? <option>Loading...</option> :
                        Object.entries(rooms).sort(([, a], [, b]) => a.localeCompare(b)).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))
                      }
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500 font-bold uppercase">座位号</Label>
                    <Input
                      placeholder="001"
                      value={seatNumber}
                      onChange={(e) => setSeatNumber(e.target.value)}
                      className="h-10 font-mono text-center tracking-widest dark:bg-slate-950 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* 带启动按钮的底部 */}
          <div className="shrink-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 z-10 lg:absolute lg:bottom-0 lg:left-0 lg:w-full">
            <Button
              className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleStartRequest}
              disabled={status === 'running' || status === 'connecting' || loadingRooms}
            >
              <Rocket className="w-5 h-5 mr-2" />
              启动任务
            </Button>
          </div>
        </div>

        {/* ---------------- 右侧栏: 控制台 ---------------- */}
        <div className={cn(
          "w-full lg:w-[60%] bg-slate-50 dark:bg-black relative flex flex-col h-full overflow-hidden transition-transform",
          activeTab === 'console' ? "flex" : "hidden lg:flex"
        )}>
          {/* 头部 */}
          <div className="shrink-0 p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 transition-colors duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3 h-3" /> 当前状态
              </h3>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-mono", wsRef.current?.readyState === 1 ? "text-green-500" : "text-slate-300")}>
                  {wsRef.current?.readyState === 1 ? "LINK AP" : "OFFLINE"}
                </span>
              </div>
            </div>

            {/* 实时倒计时显示 */}
            {countDownStr && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 flex justify-between items-center animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>距离计划执行</span>
                </div>
                <div className="font-mono text-xl font-black text-slate-700 dark:text-slate-200 tracking-widest tabular-nums">
                  {countDownStr}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                status === 'running' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                  status === 'success' ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                    status === 'failed' ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              )}>
                {status === 'running' ? <Timer className="w-6 h-6 animate-pulse" /> :
                  status === 'success' ? <CheckCircle2 className="w-6 h-6" /> :
                    status === 'failed' ? <AlertCircle className="w-6 h-6" /> :
                      <Terminal className="w-6 h-6" />}
              </div>
              <div>
                <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none break-all line-clamp-2">
                  {formatStatusMessage(latestLog)}
                </div>
                {status === 'running' && (
                  <p className="text-xs text-blue-500 font-bold mt-1 animate-pulse">正在执行任务逻辑...</p>
                )}
              </div>
              <Button size="icon" variant="ghost" className="ml-auto text-slate-400 hover:text-slate-600" onClick={() => setLogs([])} title="清空日志">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

          </div>


          {/* 可滚动日志 */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 font-mono text-sm bg-slate-50 dark:bg-black/50">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30">
                <div className="text-6xl grayscale mb-4">☕️</div>
                <p className="text-slate-400 dark:text-slate-600 font-medium">Ready when you are</p>
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
                      {/* 优化后的日志行 */}
                      <div className={cn(
                        "flex items-start gap-3 py-2 px-3 rounded-r-md border-l-2 transition-all hover:bg-black/5 dark:hover:bg-white/5",
                        log.type === "success" && "border-green-500 bg-green-50/30 dark:bg-green-900/10 text-green-800 dark:text-green-300",
                        log.type === "error" && "border-red-500 bg-red-50/30 dark:bg-red-900/10 text-red-800 dark:text-red-300",
                        log.type === "warning" && "border-amber-500 bg-amber-50/30 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300",
                        log.type === "info" && (() => {
                          if (log.message.includes("连接") || log.message.includes("通道")) return "border-blue-400 bg-blue-50/30 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300";
                          if (log.message.includes("预约") || log.message.includes("trigger")) return "border-purple-400 bg-purple-50/30 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300";
                          if (log.message.includes("模式")) return "border-pink-400 bg-pink-50/30 dark:bg-pink-900/10 text-pink-700 dark:text-pink-300";
                          if (log.message.includes("时间") || log.message.includes("倒计时")) return "border-cyan-400 bg-cyan-50/30 dark:bg-cyan-900/10 text-cyan-700 dark:text-cyan-300";
                          return "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400";
                        })()
                      )}>
                        <span className="shrink-0 font-mono text-[10px] opacity-40 w-[55px] pt-1 select-none text-right">
                          {log.timestamp.split(' ')[0]}
                        </span>

                        <div className="shrink-0 pt-0.5 opacity-70">
                          {log.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> :
                            log.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                              log.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                (log.message.includes("连接") ? <Zap className="w-3.5 h-3.5" /> :
                                  log.message.includes("预约") ? <Rocket className="w-3.5 h-3.5" /> :
                                    log.message.includes("时间") ? <Clock className="w-3.5 h-3.5" /> :
                                      <Info className="w-3.5 h-3.5" />)}
                        </div>

                        <span className="flex-1 text-sm font-medium leading-relaxed break-all font-sans tracking-wide">
                          {log.message}
                          {log.count && log.count > 1 && (
                            <span className="ml-2 inline-flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 h-4 px-1.5 rounded-full text-[9px] font-bold">
                              x{log.count}
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

          {/* 底部操作 */}
          {(status === 'running' || status !== 'idle') && (
            <div className="shrink-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 shadow-xl z-20">
              {status === 'running' ? (
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-red-500/20"
                >
                  <StopCircle className="w-5 h-5 mr-2" /> 终止任务
                </Button>
              ) : (
                <Button
                  onClick={() => setActiveTab('config')}
                  className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98] lg:hidden"
                >
                  <LayoutList className="w-5 h-5 mr-2" /> 返回配置
                </Button>
              )}
            </div>
          )}
        </div>
      </div >

      {/* 确认对话框 */}
      < Dialog open={showConfirm} onOpenChange={setShowConfirm} >
        <DialogContent>
          {/* ... 对话框内容  ... */}
          <DialogHeader>
            <DialogTitle>确认启动任务</DialogTitle>
            <DialogDescription>请确认以下配置信息无误</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg space-y-3 text-sm border dark:border-slate-800">
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
    </div >
  );
}
