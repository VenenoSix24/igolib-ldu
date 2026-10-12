import { NavLink, useNavigate } from "react-router-dom";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../../lib/utils";
import { GlassCard } from "../../components/glass/GlassCard";
import { useThemeStore, type ThemeMode } from "../../stores/theme";
import { NAV_ITEMS } from "./nav";

const THEME_QUICK: { mode: ThemeMode; title: string; icon: typeof Sun }[] = [
  { mode: "light", title: "浅色", icon: Sun },
  { mode: "dark", title: "深色", icon: Moon },
  { mode: "system", title: "跟随系统", icon: Monitor },
];

/** 桌面侧栏（>860px 唯一导航），玻璃岛形态 */
export function SideNav() {
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <GlassCard className="flex w-full flex-col p-3.5">
      <div className="mb-3 flex items-center gap-2.5 px-2 pt-1">
        <img src="/app-icon.png" alt="应用图标" className="h-6 w-6 rounded-[9px] object-cover" />
        <span className="text-[12.5px] font-extrabold tracking-tight">我去抢个座</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} className={({ isActive }) => cn("navitem", isActive && "on")}>
            <Icon className="h-[16px] w-[16px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-3">
        <div className="seg w-full">
          {THEME_QUICK.map(({ mode: m, title, icon: Icon }) => (
            <button
              key={m}
              type="button"
              title={title}
              aria-label={`主题：${title}`}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn("flex flex-1 justify-center px-0", mode === m && "on")}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate("/app/about")}
          className="mt-2.5 cursor-pointer px-2 text-[10.5px] text-sub transition-colors hover:text-ink"
        >
          关于
        </button>
      </div>
    </GlassCard>
  );
}
