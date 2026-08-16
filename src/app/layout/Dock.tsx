import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { NAV_ITEMS } from "./nav";

/**
 * 手机端底部胶囊 dock（≤860px），iOS 26 底栏形态：选中项白胶囊包住图标+文字。
 * Portal 挂到 body：脱离一切带 transform/animation 的容器，
 * 避免 fixed 元素被祖先容器当包含块钉住（跟随内容滚动的坑）。
 */
export function Dock() {
  return createPortal(
    <nav
      aria-label="底部导航"
      className="glass fixed bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-full p-1.5 md:hidden"
    >
      {NAV_ITEMS.map(({ path, shortLabel, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 rounded-full px-3.5 pt-1.5 pb-1 text-[11px] transition-all active:scale-90",
              isActive ? "bg-white/80 font-semibold text-[#131a2a]" : "opacity-60",
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          {shortLabel}
        </NavLink>
      ))}
    </nav>,
    document.body,
  );
}
