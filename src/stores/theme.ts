import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "dark" | "light";
export type AccentId =
  | "ya" | "pine" | "dai" | "zhe" | "jiang"
  | "qingci" | "xing" | "moka" | "xiang";

/** 九套强调色（色板展示用 hex 取浅色模式 --pri） */
export const ACCENTS: { id: AccentId; name: string; hex: string }[] = [
  { id: "ya", name: "鸦青", hex: "#23282F" },
  { id: "pine", name: "松烟", hex: "#175E4C" },
  { id: "dai", name: "黛青", hex: "#14545E" },
  { id: "zhe", name: "赭陶", hex: "#8F3E22" },
  { id: "jiang", name: "绛檀", hex: "#8C3A44" },
  { id: "qingci", name: "青瓷", hex: "#4FAE8E" },
  { id: "xing", name: "暖杏", hex: "#E98A5E" },
  { id: "moka", name: "莫卡", hex: "#8E6146" },
  { id: "xiang", name: "缃黄", hex: "#E5B93E" },
];

interface ThemeState {
  mode: ThemeMode;
  accent: AccentId;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
}

/** 旧版 vite-ui-theme 的取值收编进新 store */
function migrateLegacyTheme(): ThemeMode {
  const legacy = localStorage.getItem("vite-ui-theme");
  if (legacy === "dark" || legacy === "light" || legacy === "system") return legacy;
  return "system";
}

const MODES: ThemeMode[] = ["system", "dark", "light"];
const ACCENT_IDS = ACCENTS.map((a) => a.id);

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: migrateLegacyTheme(),
      accent: "ya",
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: "igolib:theme:v1",
      version: 1,
      migrate: (state) => {
        const s = (state ?? {}) as { mode?: string; accent?: string };
        const mode = MODES.includes(s.mode as ThemeMode)
          ? (s.mode as ThemeMode)
          : migrateLegacyTheme();
        const accent = ACCENT_IDS.includes(s.accent as AccentId)
          ? (s.accent as AccentId)
          : "ya";
        return { ...s, mode, accent };
      },
      // 旧 key 只在首启迁移读取一次，不再回写
      onRehydrateStorage: () => (state) => {
        if (state && !MODES.includes(state.mode)) state.mode = migrateLegacyTheme();
      },
    },
  ),
);

/** system 按系统配色解析；wallpaper 模式已在 v1 迁移中退役 */
export function resolveTheme(mode: ThemeMode, systemDark: boolean): "dark" | "light" {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

/** 将主题落到 DOM：shadcn 的 light/dark class + isle 的 data-theme/data-accent */
export function applyTheme(resolved: "dark" | "light", accent: AccentId) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
}
