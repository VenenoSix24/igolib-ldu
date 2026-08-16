import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";
import { GlassCard } from "../../components/glass/GlassCard";
import { NAV_ITEMS } from "./nav";

/** 桌面侧栏（>860px 唯一导航；S1b 接入 Cookie 剩余时长显示） */
export function SideNav() {
  return (
    <GlassCard className="hidden w-[172px] shrink-0 flex-col p-4 md:flex">
      <div className="px-3 pb-2 pt-1 text-[10px] tracking-widest opacity-50">导航</div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "rounded-xl px-3.5 py-2.5 text-sm transition-opacity",
                isActive ? "bg-white/20 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]" : "opacity-70 hover:opacity-100",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </GlassCard>
  );
}
