/**
 * 弹窗的遮罩与容器。
 *
 * 背景：Windows(WebView2) 上弹窗的淡入/淡出会呈现为半透明残影，且遮罩的明暗
 * 与残影不同步（遮罩先消失、半透明面板挂在变亮的应用上），用户感知为"闪屏"；
 * macOS(WKWebView) 与 Android 上同样的动画是平滑的。因此 Windows 上不做过渡
 * 动画，弹窗直接出现/消失（与原生 Windows 对话框一致）；其他平台保留原有动画。
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { IS_WINDOWS } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface OverlayProps {
  onClose: () => void;
  /** 附加类名（如 backdrop-blur-sm，Windows 上由本组件内部禁用） */
  className?: string;
}

export function ModalOverlay({ onClose, className }: OverlayProps) {
  const cls = cn("fixed inset-0 z-50", className);

  if (IS_WINDOWS) {
    return <div className={cls} onClick={onClose} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cls}
      onClick={onClose}
    />
  );
}

interface PanelProps {
  className?: string;
  children: ReactNode;
  /** 入场/退场的起始缩放，各弹窗略有差异 */
  initialScale?: number;
  damping?: number;
  stiffness?: number;
}

export function ModalPanel({
  className,
  children,
  initialScale = 0.95,
  damping = 25,
  stiffness = 300,
}: PanelProps) {
  if (IS_WINDOWS) {
    // Windows：无动画，但仍需保持 left-1/2 top-1/2 的居中位移
    return (
      <div className={className} style={{ transform: "translate(-50%, -50%)" }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: initialScale }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: initialScale }}
      transition={{ type: "spring", damping, stiffness }}
      style={{ x: "-50%", y: "-50%" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
