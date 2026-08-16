import type { LucideIcon } from "lucide-react";
import { CalendarClock, House, Radar, RefreshCw, Zap } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  /** 移动端短标签（dock 用） */
  shortLabel: string;
  icon: LucideIcon;
}

/** 五个导航位 = 2.0 功能域；原设置域升级为首页，日志与低频设置收进首页二级 */
export const NAV_ITEMS: NavItem[] = [
  { path: "/app/home", label: "首页", shortLabel: "首页", icon: House },
  { path: "/app/tomorrow", label: "明日预约", shortLabel: "明日", icon: CalendarClock },
  { path: "/app/grab", label: "立即抢座", shortLabel: "抢座", icon: Zap },
  { path: "/app/scanner", label: "场馆捡漏", shortLabel: "捡漏", icon: Radar },
  { path: "/app/renewal", label: "占座续约", shortLabel: "续约", icon: RefreshCw },
];
