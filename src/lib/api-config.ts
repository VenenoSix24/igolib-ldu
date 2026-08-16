// 预设配置
export const PRESETS = {
  ldu: {
    name: "卤蛋大学",
    apiUrl: "https://libseats.ldu.edu.cn/index.php/graphql/",
    origin: "https://libseats.ldu.edu.cn",
    referer: "https://libseats.ldu.edu.cn/web/index.html",
    wxAppId: "wx79d0fc3c9dd1da03"
  },
  official: {
    name: "官方原版",
    apiUrl: "https://wechat.v2.traceint.com/index.php/graphql/",
    origin: "https://web.traceint.com",
    referer: "https://web.traceint.com/",
    wxAppId: "wx2996d437cd442527"
  },
} as const;

export type PresetKey = keyof typeof PRESETS | "custom";

export interface ApiConfig {
  preset: PresetKey;
  apiUrl: string;
  origin: string;
  referer: string;
  wxAppId: string;
}

// 默认配置
export const DEFAULT_CONFIG: ApiConfig = {
  preset: "ldu",
  ...PRESETS.ldu,
};

// 本地存储键名
const STORAGE_KEY = "igolib_api_config";

/**
 * 从 localStorage 加载配置
 */
export function loadApiConfig(): ApiConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn("加载 API 配置失败:", e);
  }
  return DEFAULT_CONFIG;
}

/**
 * 保存配置到 localStorage
 */
export function saveApiConfig(config: ApiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn("保存 API 配置失败:", e);
  }
}
