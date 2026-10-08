import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createLogger, installGlobalErrorHandlers } from './lib/logger'

// 尽早挂上全局错误捕获，避免启动阶段的异常完全没有记录
installGlobalErrorHandlers()

// 一条启动分隔线，便于在日志里快速定位"这一次会话"
createLogger('boot').info('应用启动', {
  userAgent: navigator.userAgent,
  href: window.location.href,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
