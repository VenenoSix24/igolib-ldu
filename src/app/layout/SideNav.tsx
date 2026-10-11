import { NavLink } from "react-router-dom";
import { BookMarked, Monitor, Moon, Sun } from "lucide-react";
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
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <GlassCard className="flex w-full flex-col p-3.5">
      <div className="mb-3 flex items-center gap-2.5 px-2 pt-1">
        <span className="grid h-6 w-6 place-items-center rounded-[9px] bg-gradient-to-br from-pri to-acc text-[#fff]">
          <BookMarked className="h-3.5 w-3.5" />
        </span>
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
        <div className="flex items-center justify-around rounded-[14px] border border-[var(--line2)] bg-[rgba(100,116,139,0.08)] p-1.5">
          {THEME_QUICK.map(({ mode: m, title, icon: Icon }) => (
            <button
              key={m}
              type="button"
              title={title}
              aria-label={`主题：${title}`}
              onClick={() => setMode(m)}
              className={cn(
                "grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] transition-all active:scale-90",
                mode === m
                  ? "bg-[var(--glass-3)] text-ink shadow-[var(--sh-row)]"
                  : "text-sub opacity-70 hover:opacity-100",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
