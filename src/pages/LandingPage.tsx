import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import logo from "../assets/android-chrome-192x192.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, AlertTriangle, RefreshCw, Github } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleNavigate = () => {
    setIsExiting(true);
    setTimeout(() => {
      navigate("/dashboard");
    }, 300); // 简单淡入淡出的更快持续时间
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      localStorage.clear();
      sessionStorage.clear();
      // 清除浏览器 Cookie
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // 延迟一秒让用户看到反馈，然后刷新
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 1000);
    } catch (e) {
      console.error("重置失败:", e);
      setIsResetting(false);
      setShowResetDialog(false);
      alert("重置过程中遇到错误，请手动清理浏览器缓存。");
    }
  };

  useEffect(() => {
    // 功能卡片使用的鼠标移动效果
    const handleMouseMove = (e: MouseEvent) => {
      document.querySelectorAll<HTMLElement>('.feature-card-spotlight').forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <motion.div
      className="bg-background-dark text-white overflow-x-hidden min-h-screen flex flex-col font-sans"
      initial={{ opacity: 0 }}
      animate={{
        opacity: isExiting ? 0 : 1,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 moving-grid"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[80%] bg-gradient-to-br from-brand/10 via-teal-500/5 to-transparent blur-[120px] rounded-full animate-beam"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-gradient-to-tl from-teal-500/10 via-brand/5 to-transparent blur-[100px] rounded-full animate-beam" style={{ animationDelay: "-7s" }}></div>
        <div className="star-dust left-[10%] top-[20%]" style={{ animationDelay: "0s" }}></div>
        <div className="star-dust left-[30%] top-[50%]" style={{ animationDelay: "1s" }}></div>
        <div className="star-dust left-[70%] top-[30%]" style={{ animationDelay: "2s" }}></div>
        <div className="star-dust left-[85%] top-[70%]" style={{ animationDelay: "3s" }}></div>
        <div className="star-dust left-[50%] top-[80%]" style={{ animationDelay: "1.5s" }}></div>
      </div>

      <nav className="sticky top-0 z-50 w-full glass-panel border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-md" />
            <span className="text-xl font-bold tracking-tight">我去抢个座</span>
          </div>
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-sm font-medium text-gray-400">
            <a className="hover:text-white transition-colors" href="#features">功能特性</a>
            <a className="hover:text-white transition-colors" href="#how-it-works">使用流程</a>
            <a className="hover:text-white transition-colors flex items-center gap-1" href="https://github.com/VenenoSix24/igolib-ldu" target="_blank">
              GitHub <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowResetDialog(true)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
              title="重置应用"
            >
              <span className="material-symbols-outlined text-xl">delete_forever</span>
            </button>
            <button
              onClick={handleNavigate}
              className="btn-premium-silver px-5 py-2 rounded-lg text-sm font-bold"
            >
              立即使用
            </button>
          </div>
        </div>
      </nav>

      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-brand/10 rounded-full blur-[120px] -z-10 animate-pulse-slow"></div>
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center z-10 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-brand mb-8 hover:bg-white/10 transition-colors cursor-default backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
            </span>
            v4.6.25 TS 现已发布 - 全平台应用上线 !
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 max-w-5xl gradient-text-hero pb-2 leading-tight relative z-20">
            <span className="absolute inset-0 blur-3xl bg-brand/20 -z-10 opacity-50"></span>
            图书馆预约，从未如此简单
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed font-medium">
            专为学生设计的现代化图书馆座位预约自动化系统，稳定、快速、可靠。
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-24 w-full justify-center">
            <button
              onClick={handleNavigate}
              className="w-full sm:w-40 h-12 px-0 btn-premium-silver rounded-lg font-bold text-base flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              进入系统
            </button>
            <button
              onClick={() => window.open("https://github.com/VenenoSix24/igolib-ldu", "_blank")}
              className="w-full sm:w-40 h-12 px-0 bg-surface-dark border border-white/10 hover:border-white/30 text-white rounded-lg font-bold text-base transition-all flex items-center justify-center gap-2 hover:bg-white/5"
            >
              <Github className="w-5 h-5" />
              GitHub
            </button>
          </div>

          <div className="relative w-full max-w-6xl group perspective-1000 mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand via-accent-indigo to-accent-purple rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative glass-panel rounded-xl border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[500px]">

              {/* 左侧面板: 配置模型 */}
              <div className="w-full md:w-5/12 border-r-[0.5px] border-white/10 bg-[#161b22]/80 backdrop-blur-md p-6 flex flex-col gap-6 text-left relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/5 to-transparent opacity-50"></div>
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-brand">rocket_launch</span>
                    <h3 className="text-lg font-bold">任务配置</h3>
                  </div>
                  <span className="material-symbols-outlined text-gray-500 cursor-pointer hover:text-white transition-colors">settings</span>
                </div>

                <div className="relative z-10">
                  <label className="text-xs text-gray-500 mb-2 block font-medium">操作模式</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-brand bg-brand/10 text-brand transition-all">
                      <span className="material-symbols-outlined mb-1">calendar_month</span>
                      <span className="text-sm font-bold">明日预约</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-3 rounded-lg border border-white/10 bg-surface-lighter text-gray-400 hover:border-white/20 hover:text-gray-200 transition-all">
                      <span className="material-symbols-outlined mb-1">bolt</span>
                      <span className="text-sm font-medium">立即抢座</span>
                    </button>
                  </div>
                </div>

                <div className="relative z-10">
                  <label className="text-xs text-gray-500 mb-2 block font-medium">身份 COOKIE</label>
                  <div className="relative">
                    <input className="w-full bg-surface-lighter border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand/50 cursor-not-allowed" readOnly type="text" value="••••••••••••••••••••" />
                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-gray-500 text-sm cursor-pointer hover:text-white">visibility</span>
                  </div>
                </div>

                <div className="relative z-10">
                  <label className="text-xs text-gray-500 mb-2 block font-medium">执行时间</label>
                  <div className="bg-surface-lighter rounded-lg p-1 flex text-sm mb-4">
                    <div className="flex-1 text-center py-1.5 bg-brand rounded text-white font-medium shadow-sm cursor-default">立即执行</div>
                    <div className="flex-1 text-center py-1.5 text-gray-400 cursor-pointer hover:text-gray-200">21:48</div>
                    <div className="flex-1 text-center py-1.5 text-gray-400 cursor-pointer hover:text-gray-200">自定义</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">阅览室 <span className="text-green-500">✓ 实时</span></label>
                      <div className="bg-surface-lighter border border-white/10 rounded px-3 py-2 text-sm text-gray-300 flex justify-between items-center">
                        602自习室
                        <span className="material-symbols-outlined text-xs">expand_more</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">座位号 <span className="text-green-500">(158可用)</span></label>
                      <div className="bg-surface-lighter border border-white/10 rounded px-3 py-2 text-sm text-gray-300 text-center font-mono">
                        102
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 relative z-10">
                  <button onClick={handleNavigate} className="w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold shadow-lg shadow-brand/20 hover:shadow-brand/40 transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">rocket_launch</span>
                    启动任务
                  </button>
                </div>
              </div>

              {/* 右侧面板: 控制台模型 */}
              <div className="w-full md:w-7/12 bg-[#0d1117]/95 p-0 flex flex-col text-left font-mono text-sm relative overflow-hidden">
                <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-surface-dark/50">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs text-gray-400">系统在线</span>
                  </div>
                  <span className="text-xs text-gray-600">v4.6.25-TS</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3 font-mono text-xs md:text-sm relative z-10">
                  <div className="flex gap-3 opacity-60">
                    <span className="text-gray-500 select-none">15:33:24</span>
                    <span className="text-gray-300">正在连接服务器通道...</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-500 select-none">15:33:24</span>
                    <span className="text-green-400 font-semibold">控制通道已建立</span>
                  </div>
                  <div className="flex gap-3 opacity-80">
                    <span className="text-gray-500 select-none">15:33:24</span>
                    <span className="text-gray-300">正在下发任务指令...</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-500 select-none">15:33:24</span>
                    <span className="text-green-400">任务指令已接收</span>
                  </div>
                  <div className="flex gap-3 my-2 border-y border-white/5 py-2 bg-white/[0.02]">
                    <span className="text-gray-500 select-none">15:33:24</span>
                    <span className="text-gray-300">--- 开始执行 <span className="text-brand">预约</span> 操作---</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-500 select-none">15:33:24</span>
                    <span className="text-gray-300">模式: 明日预约 | 阅览室: 602自习室 | 座位: 102</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-500 select-none">15:33:24</span>
                    <span className="text-white">正在排队中...</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-500 select-none">15:33:25</span>
                    <span className="text-green-400">成功进入系统</span>
                  </div>
                  <div className="flex gap-3 p-2 bg-green-500/10 border-l-2 border-green-500 rounded-r">
                    <span className="text-gray-500 select-none">15:33:26</span>
                    <span className="text-green-400 font-bold">预约座位成功：602自习室 102号</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-500 select-none">15:33:27</span>
                    <span className="text-white">正在同步预约信息... <span className="text-green-500 font-bold animate-pulse">_</span></span>
                  </div>
                </div>
                <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-surface-dark border-y border-white/5 relative" id="features">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">为什么选择 我去抢个座？</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">专为速度、可靠性和学习打造。我们的工具给你带来“不公平”的优势。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 group bg-[#1c2128] rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 feature-card-spotlight"></div>
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-4 text-brand group-hover:bg-brand group-hover:text-white transition-all duration-300 relative z-10 group-hover:scale-110">
                <span className="material-symbols-outlined text-2xl">schedule</span>
              </div>
              <h3 className="text-lg font-bold mb-2 relative z-10 text-gray-100 group-hover:text-white">智能定时</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10 group-hover:text-gray-300">
                立即执行或设定特定时间自动运行，带有精准倒计时。
              </p>
            </div>
            <div className="p-6 group bg-[#1c2128] rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 feature-card-spotlight"></div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 text-green-400 group-hover:bg-green-500 group-hover:text-white transition-all duration-300 relative z-10 group-hover:scale-110">
                <span className="material-symbols-outlined text-2xl">sync</span>
              </div>
              <h3 className="text-lg font-bold mb-2 relative z-10 text-gray-100 group-hover:text-white">动态数据</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10 group-hover:text-gray-300">
                实时获取场馆列表和可用座位，无需手动维护静态数据。
              </p>
            </div>
            <div className="p-6 group bg-[#1c2128] rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 feature-card-spotlight"></div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 relative z-10 group-hover:scale-110">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <h3 className="text-lg font-bold mb-2 relative z-10 text-gray-100 group-hover:text-white">多学校支持</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10 group-hover:text-gray-300">
                内置预设配置，支持自定义 API 地址、Origin 和 Referer。
              </p>
            </div>
            <div className="p-6 group bg-[#1c2128] rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 feature-card-spotlight"></div>
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-4 text-brand group-hover:bg-brand group-hover:text-white transition-all duration-300 relative z-10 group-hover:scale-110">
                <span className="material-symbols-outlined text-2xl">terminal</span>
              </div>
              <h3 className="text-lg font-bold mb-2 relative z-10 text-gray-100 group-hover:text-white">实时日志</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10 group-hover:text-gray-300">
                WebSocket 实时推送抢座日志，毫秒级精度反馈。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 relative overflow-hidden" id="how-it-works">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-brand/5 rounded-full blur-3xl -z-10 translate-y-1/2 translate-x-1/4"></div>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <div className="w-full md:w-1/2">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">准备好锁定座位了吗？</h2>
              <p className="text-gray-400 mb-10 text-lg">只需简单三步，即可开启自动抢座之旅。</p>
              <div className="relative pl-8 border-l border-white/10 space-y-12">
                <div className="relative group">
                  <span className="absolute -left-[41px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-surface-dark border-2 border-brand text-brand transition-transform group-hover:scale-125 shadow-[0_0_10px_rgba(25,127,230,0.4)]">
                    <span className="h-2 w-2 rounded-full bg-brand"></span>
                  </span>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className="material-symbols-outlined text-brand">cookie</span>
                    获取 Cookie
                  </h3>
                  <p className="text-gray-400">根据教程进行抓包，安全地从图书馆网站/小程序获取您的会话 Cookie。</p>
                </div>
                <div className="relative group">
                  <span className="absolute -left-[41px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-surface-dark border-2 border-white/20 text-gray-500 transition-transform group-hover:border-brand group-hover:scale-125 group-hover:text-brand group-hover:shadow-[0_0_10px_rgba(25,127,230,0.4)]">
                    <span className="h-2 w-2 rounded-full bg-white/20 group-hover:bg-brand transition-colors"></span>
                  </span>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className="material-symbols-outlined text-gray-300 group-hover:text-brand transition-colors">meeting_room</span>
                    选择阅览室 & 座位
                  </h3>
                  <p className="text-gray-400">在项目配置页面上选择您偏好的阅览室和具体座位号。</p>
                </div>
                <div className="relative group">
                  <span className="absolute -left-[41px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-surface-dark border-2 border-white/20 text-gray-500 transition-transform group-hover:border-brand group-hover:scale-125 group-hover:text-brand group-hover:shadow-[0_0_10px_rgba(25,127,230,0.4)]">
                    <span className="h-2 w-2 rounded-full bg-white/20 group-hover:bg-brand transition-colors"></span>
                  </span>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className="material-symbols-outlined text-gray-300 group-hover:text-brand transition-colors">verified</span>
                    坐享其成
                  </h3>
                  <p className="text-gray-400">设置定时器，剩下的交给 我去抢个座。座位到手后会通知您。</p>
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/2 flex justify-center md:justify-end">
              <div className="relative w-full max-w-md aspect-square animate-float">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="relative z-10 glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl h-full flex flex-col items-center justify-center text-center gap-6 transform hover:scale-105 transition-transform duration-500">
                  <div className="w-24 h-24 rounded-full bg-brand/20 flex items-center justify-center text-brand mb-4 shadow-[0_0_30px_rgba(25,127,230,0.2)]">
                    <span className="material-symbols-outlined text-5xl">check_circle</span>
                  </div>
                  <h3 className="text-2xl font-bold">座位已确认！</h3>
                  <p className="text-gray-400">您预订的 <span className="text-white font-medium bg-white/10 px-2 py-0.5 rounded">602 自习室 | 座位: 102</span> 已确认，时间为明天早上 08:00。</p>
                  <button className="mt-4 px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors w-full flex items-center justify-center gap-2">
                    立即查看
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto relative rounded-3xl overflow-hidden bg-gradient-to-r from-brand-dark to-accent-indigo text-center p-12 md:p-20 shadow-2xl group border border-white/10">
          <div className="absolute top-0 right-0 p-12 opacity-10 transform group-hover:rotate-12 transition-transform duration-700">
            <span className="material-symbols-outlined text-9xl text-white">bolt</span>
          </div>
          <div className="absolute bottom-0 left-0 p-8 opacity-10 transform group-hover:-rotate-12 transition-transform duration-700">
            <span className="material-symbols-outlined text-8xl text-white">code</span>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black mb-6 text-white tracking-tight">告别手动抢座的烦恼。</h2>
            <p className="text-blue-100 text-lg md:text-xl mb-12 max-w-2xl mx-auto">
              加入成千上万不再为图书馆座位发愁的同学行列。开源、快速、可靠。
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={handleNavigate}
                className="bg-white text-brand hover:bg-gray-100 px-8 h-16 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-105 hover:shadow-xl border border-transparent"
              >
                立即开始
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button
                onClick={() => window.open("https://github.com/VenenoSix24/igolib-ldu", "_blank")}
                className="bg-black/40 hover:bg-black/60 text-white px-8 h-16 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-105 hover:shadow-xl border border-white/20 backdrop-blur-md"
              >
                <span className="material-symbols-outlined">star</span>
                GitHub 点个 Star 吧
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-white/5 bg-background-dark">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-gray-500 text-sm font-semibold uppercase tracking-wider mb-12">技术栈与强力驱动</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24">
            <div className="flex items-center gap-4 group cursor-default tech-icon-wrapper p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all opacity-60 hover:opacity-100 duration-500">
              <img alt="FastAPI" className="h-10 w-10 object-contain group-hover:drop-shadow-[0_0_12px_rgba(20,184,166,0.6)] transition-all" src="https://cdn.worldvectorlogo.com/logos/fastapi.svg" />
              <span className="text-xl font-bold text-gray-300 group-hover:text-white transition-colors">FastAPI</span>
            </div>
            <div className="flex items-center gap-4 group cursor-default tech-icon-wrapper p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all opacity-60 hover:opacity-100 duration-500">
              <img alt="Python" className="h-10 w-10 object-contain group-hover:drop-shadow-[0_0_12px_rgba(234,179,8,0.6)] transition-all" src="https://cdn.worldvectorlogo.com/logos/python-5.svg" />
              <span className="text-xl font-bold text-gray-300 group-hover:text-white transition-colors">Python</span>
            </div>
            <div className="flex items-center gap-4 group cursor-default tech-icon-wrapper p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all opacity-60 hover:opacity-100 duration-500">
              <img alt="TailwindCSS" className="h-10 w-10 object-contain group-hover:drop-shadow-[0_0_12px_rgba(56,189,248,0.6)] transition-all" src="https://cdn.worldvectorlogo.com/logos/tailwindcss.svg" />
              <span className="text-xl font-bold text-gray-300 group-hover:text-white transition-colors">Tailwind CSS</span>
            </div>
            <div className="flex items-center gap-4 group cursor-default tech-icon-wrapper p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all opacity-60 hover:opacity-100 duration-500">
              <div className="h-10 w-10 flex items-center justify-center rounded-full bg-white text-black group-hover:shadow-[0_0_15px_rgba(255,255,255,0.6)] transition-all">
                <span className="material-symbols-outlined text-2xl">sync_alt</span>
              </div>
              <span className="text-xl font-bold text-gray-300 group-hover:text-white transition-colors">WebSocket</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-surface-dark border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Logo" className="w-6 h-6 grayscale opacity-70" />
              <span className="text-lg font-bold">我去抢个座</span>
            </div>
            <p className="text-sm text-gray-400">
              © 2026 iGoLib_LDU Project. 遵循 <span className="font-semibold text-gray-200">MIT License</span> 开源协议。<br />
              <span className="font-semibold text-gray-300 opacity-90 block mt-1">本项目仅供学习研究使用。</span>
            </p>
          </div>
          <div className="flex gap-6">
            <a className="text-gray-400 hover:text-white transition-colors" href="#">
              <span className="sr-only">Twitter</span>
              <svg aria-hidden="true" className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path></svg>
            </a>
            <a className="text-gray-400 hover:text-white transition-colors" href="https://github.com/VenenoSix24/igolib-ldu">
              <span className="sr-only">GitHub</span>
              <svg aria-hidden="true" className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd"></path></svg>
            </a>
          </div>
        </div>
      </footer>

      {/* 重置确认对话框 */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-neutral-950 border-slate-200 dark:border-white/10 text-neutral-900 dark:text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" /> 彻底清空数据
            </DialogTitle>
            <DialogDescription className="text-gray-400 pt-2 text-sm leading-relaxed">
              确定要清空所有本地配置吗？这将包括：
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>身份 Cookie</li>
                <li>API 节点设置</li>
                <li>选中的场馆与座位</li>
                <li>主题偏好设置</li>
              </ul>
              <p className="mt-3 font-bold text-red-400/80">※ 此操作不可撤销！</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-3">
            <Button
              variant="ghost"
              onClick={() => setShowResetDialog(false)}
              className="text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              disabled={isResetting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  正在重置...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  确认清空
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
