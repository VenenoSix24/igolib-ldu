import { GlassCard } from "../../../components/glass/GlassCard";
import { SlidingTabs } from "../../../components/glass/SlidingTabs";
import { useThemeStore, type ThemeMode } from "../../../stores/theme";

const THEME_ITEMS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "wallpaper", label: "壁纸" },
];

export function SettingsPage() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <GlassCard hoverable className="p-8">
      <h1 className="text-lg font-semibold">设置</h1>
      <p className="mt-1 text-xs opacity-50">开发中 · API 预设、通知、扫描参数等设置项随后到位</p>

      <div className="mt-6">
        <div className="mb-2 text-xs opacity-60">主题</div>
        <GlassCard className="inline-flex gap-1 rounded-full p-1.5">
          <SlidingTabs
            aria-label="主题切换"
            layoutId="settings-theme-ind"
            items={THEME_ITEMS}
            value={mode}
            onChange={setMode}
          />
        </GlassCard>
      </div>
    </GlassCard>
  );
}
