import { useThemeStore } from "../../stores/theme";
import { BUILTIN_WALLPAPERS } from "@/lib/wallpapers";

export function WallpaperLayer() {
  const mode = useThemeStore((s) => s.mode);
  const wallpaper = useThemeStore((s) => s.wallpaper);
  if (mode !== "wallpaper") return null;

  const src = wallpaper || BUILTIN_WALLPAPERS[0];
  return <div className="wallpaper-layer" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />;
}
