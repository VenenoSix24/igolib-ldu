import { NavLink } from "react-router-dom";
import { BookMarked, Image as ImageIcon, Moon, Sun } from "lucide-react";
import { cn } from "../../lib/utils";
import { GlassCard } from "../../components/glass/GlassCard";
import { useThemeStore, type ThemeMode } from "../../stores/theme";
import { NAV_ITEMS } from "./nav";

const THEME_QUICK: { mode: ThemeMode; title: string; icon: typeof Sun }[] = [
  { mode: "light", title: "浅色", icon: Sun },
  { mode: "dark", title: "深色", icon: Moon },
  { mode: "wallpaper", title: "壁纸", icon: ImageIcon },
];

/** 桌面侧栏（>860px 唯一导航），整块玻璃卡片与内容区风格统一 */
export function SideNav() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <GlassCard className="flex w-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2.5 px-2">
        <BookMarked className="h-5 w-5 opacity-80" />
        <span className="text-sm font-semibold tracking-wide">我去抢个座</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all",
                isActive
                  ? "bg-[#1B2230]/[0.08] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-white/20"
                  : "opacity-65 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5",
              )
            }
          >
            <Icon className="h-[17px] w-[17px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-around rounded-2xl border border-white/10 bg-white/5 p-1.5">
          {THEME_QUICK.map(({ mode: m, title, icon: Icon }) => (
            <button
              key={m}
              title={title}
              aria-label={`主题：${title}`}
              onClick={() => setMode(m)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-90",
                mode === m ? "bg-white/75 text-[#131a2a]" : "opacity-55 hover:opacity-90",
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
