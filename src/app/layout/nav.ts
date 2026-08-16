import type { LucideIcon } from "lucide-react";
import { CalendarClock, Radar, RefreshCw, ScrollText, Settings2 } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  /** 移动端短标签（dock 用） */
  shortLabel: string;
  icon: LucideIcon;
}

/** 五个导航位 = 2.0 功能域；dock 已满员，后续新功能走二级页 */
export const NAV_ITEMS: NavItem[] = [
  { path: "/app/booking", label: "预约", shortLabel: "预约", icon: CalendarClock },
  { path: "/app/scanner", label: "捡漏", shortLabel: "捡漏", icon: Radar },
  { path: "/app/renewal", label: "续约", shortLabel: "续约", icon: RefreshCw },
  { path: "/app/logs", label: "日志", shortLabel: "日志", icon: ScrollText },
  { path: "/app/settings", label: "设置", shortLabel: "设置", icon: Settings2 },
];
