import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { NAV_ITEMS } from "./nav";

/**
 * 手机端底部椭圆胶囊 dock（≤860px）。
 * Portal 挂到 body：脱离一切带 transform/animation 的容器，
 * 避免 fixed 元素被祖先容器当包含块钉住（跟随内容滚动的坑）。
 */
export function Dock() {
  return createPortal(
    <nav
      aria-label="底部导航"
      className="glass fixed bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-full p-1.5 md:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 rounded-full px-4 pt-2 pb-1.5 text-[11px] transition-all",
              "active:scale-90",
              isActive ? "font-semibold text-[#131a2a]" : "opacity-60",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "h-[22px] w-[22px] rounded-full border-[1.5px] border-current opacity-75",
                  isActive && "border-[rgba(19,26,42,0.55)] opacity-100",
                )}
              />
              {item.shortLabel}
            </>
          )}
        </NavLink>
      ))}
    </nav>,
    document.body,
  );
}
