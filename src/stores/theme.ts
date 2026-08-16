import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "dark" | "light" | "wallpaper";

interface ThemeState {
  mode: ThemeMode;
  /** 用户自选壁纸（URL 或 dataURL）；空 = 内置壁纸 */
  wallpaper: string;
  setMode: (mode: ThemeMode) => void;
  setWallpaper: (src: string) => void;
}

/** 旧版 vite-ui-theme 的取值收编进新 store */
function migrateLegacyTheme(): ThemeMode {
  const legacy = localStorage.getItem("vite-ui-theme");
  if (legacy === "dark" || legacy === "light" || legacy === "system") return legacy;
  return "system";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: migrateLegacyTheme(),
      wallpaper: "",
      setMode: (mode) => set({ mode }),
      setWallpaper: (wallpaper) => set({ wallpaper }),
    }),
    {
      name: "igolib:theme:v1",
      // 旧 key 只在首启迁移读取一次，不再回写
      onRehydrateStorage: () => (state) => {
        if (state) state.mode = state.mode ?? migrateLegacyTheme();
      },
    },
  ),
);

/** wallpaper 模式按深色玻璃渲染，其余模式解析 system 后落到 dark/light */
export function resolveTheme(mode: ThemeMode, systemDark: boolean): "dark" | "light" | "wallpaper" {
  if (mode === "wallpaper") return "wallpaper";
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

/** 将主题落到 DOM：shadcn 的 light/dark class + 玻璃体系的 data-app-theme */
export function applyTheme(resolved: "dark" | "light" | "wallpaper") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved === "light" ? "light" : "dark");
  root.dataset.appTheme = resolved;
}
