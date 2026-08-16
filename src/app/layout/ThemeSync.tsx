import { useEffect } from "react";
import { applyTheme, resolveTheme, useThemeStore } from "../../stores/theme";

/** 订阅主题 store 与系统配色，把结果落到 DOM（shadcn class + data-app-theme） */
export function ThemeSync() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(resolveTheme(mode, media.matches));
    sync();
    if (mode === "system") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
  }, [mode]);

  return null;
}
