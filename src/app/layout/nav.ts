import type { LucideIcon } from "lucide-react";
import { CalendarClock, House, Info, Radar, RefreshCw, Zap } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  /** 移动端短标签（dock 用） */
  shortLabel: string;
  icon: LucideIcon;
  /** 是否进手机端底部 dock（关于等低频页只进侧栏） */
  dock?: boolean;
}

/** 五个功能域 + 关于；原设置域升级为首页，日志与低频设置收进首页二级 */
export const NAV_ITEMS: NavItem[] = [
  { path: "/app/home", label: "首页", shortLabel: "首页", icon: House, dock: true },
  { path: "/app/tomorrow", label: "明日预约", shortLabel: "预约", icon: CalendarClock, dock: true },
  { path: "/app/grab", label: "立即抢座", shortLabel: "抢座", icon: Zap, dock: true },
  { path: "/app/scanner", label: "场馆捡漏", shortLabel: "捡漏", icon: Radar, dock: true },
  { path: "/app/renewal", label: "占座续约", shortLabel: "续约", icon: RefreshCw, dock: true },
  { path: "/app/about", label: "关于", shortLabel: "关于", icon: Info, dock: false },
];
