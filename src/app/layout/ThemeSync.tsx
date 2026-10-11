import { useEffect } from "react";
import { applyTheme, resolveTheme, useThemeStore } from "../../stores/theme";

/** 订阅主题 store 与系统配色，把结果落到 DOM（shadcn class + isle data 属性） */
export function ThemeSync() {
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(resolveTheme(mode, media.matches), accent);
    sync();
    if (mode === "system") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
  }, [mode, accent]);

  return null;
}
