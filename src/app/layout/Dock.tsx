import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { NAV_ITEMS } from "./nav";

/**
 * 手机端底部胶囊 dock（≤860px）：磨砂玻璃浮岛，选中项亮胶囊。
 * Portal 挂到 body：脱离一切带 transform/animation 的容器，
 * 避免 fixed 元素被祖先容器当包含块钉住（跟随内容滚动的坑）。
 */
export function Dock() {
  return createPortal(
    <nav
      aria-label="底部导航"
      className="glass dockbar fixed bottom-[calc(env(safe-area-inset-bottom)+14px)] left-1/2 z-10 flex -translate-x-1/2 items-stretch gap-0.5 rounded-full p-1.5 md:hidden"
    >
      {NAV_ITEMS.filter((item) => item.dock).map(({ path, shortLabel, icon: Icon }) => (
        <NavLink key={path} to={path} className={({ isActive }) => cn("dockitem", isActive && "on")}>
          <Icon className="h-[18px] w-[18px]" />
          {shortLabel}
        </NavLink>
      ))}
    </nav>,
    document.body,
  );
}
