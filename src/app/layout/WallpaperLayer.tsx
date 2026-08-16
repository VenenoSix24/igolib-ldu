import { useThemeStore } from "../../stores/theme";

/** 内置壁纸（2.0 首批仅一张，后续在设置页扩充与自选） */
const BUILTIN_WALLPAPERS = [
  "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1600&q=70&auto=format&fit=crop",
];

export function WallpaperLayer() {
  const mode = useThemeStore((s) => s.mode);
  const wallpaper = useThemeStore((s) => s.wallpaper);
  if (mode !== "wallpaper") return null;

  const src = wallpaper || BUILTIN_WALLPAPERS[0];
  return <div className="wallpaper-layer" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />;
}
