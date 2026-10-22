import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 到期表盘中心的极短剩余文案（完整时长用 formatRemaining） */
export function compactRemaining(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}天`
  if (h > 0) return `${h}时`
  return `${m}分`
}
