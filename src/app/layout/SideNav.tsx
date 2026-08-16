import { NavLink } from "react-router-dom";
import { BookMarked, Image as ImageIcon, Moon, Sun } from "lucide-react";
import { cn } from "../../lib/utils";
import { useThemeStore, type ThemeMode } from "../../stores/theme";
import { NAV_ITEMS } from "./nav";

const THEME_QUICK: { mode: ThemeMode; title: string; icon: typeof Sun }[] = [
  { mode: "light", title: "浅色", icon: Sun },
  { mode: "dark", title: "深色", icon: Moon },
  { mode: "wallpaper", title: "壁纸", icon: ImageIcon },
];

/** 桌面侧栏（>860px 唯一导航） */
export function SideNav() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <aside className="hidden w-[196px] shrink-0 flex-col md:flex">
      <div className="mb-4 flex items-center gap-2.5 px-3">
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
                  ? "glass font-semibold shadow-none"
                  : "opacity-65 hover:bg-white/5 hover:opacity-100",
              )
            }
          >
            <Icon className="h-[17px] w-[17px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <div className="glass flex items-center justify-around rounded-2xl p-1.5">
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
    </aside>
  );
}
