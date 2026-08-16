export interface NavItem {
  path: string;
  label: string;
  /** 移动端短标签（dock 用） */
  shortLabel: string;
}

/** 五个导航位 = 2.0 功能域；dock 已满员，后续新功能走二级页 */
export const NAV_ITEMS: NavItem[] = [
  { path: "/app/booking", label: "预约", shortLabel: "预约" },
  { path: "/app/scanner", label: "捡漏", shortLabel: "捡漏" },
  { path: "/app/renewal", label: "续约", shortLabel: "续约" },
  { path: "/app/logs", label: "日志", shortLabel: "日志" },
  { path: "/app/settings", label: "设置", shortLabel: "设置" },
];
