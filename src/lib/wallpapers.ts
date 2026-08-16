/** 内置壁纸（暗调图书馆/自习室主题）；自定义壁纸走 theme store 的 wallpaper 字段 */
export const BUILTIN_WALLPAPERS: string[] = [
  "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1600&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1600&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1600&q=70&auto=format&fit=crop",
];

/** 缩略图（选择器用小图，节省流量） */
export function thumbOf(url: string): string {
  return url.replace("w=1600", "w=400");
}
