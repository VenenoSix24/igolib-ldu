import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// 预设配置
export const PRESETS = {
  ldu: {
    name: "卤蛋大学",
    apiUrl: "https://libseats.ldu.edu.cn/index.php/graphql/",
    origin: "https://libseats.ldu.edu.cn",
    referer: "https://libseats.ldu.edu.cn/web/index.html",
  },
  official: {
    name: "官方原版",
    apiUrl: "https://wechat.v2.traceint.com/index.php/graphql/",
    origin: "https://web.traceint.com",
    referer: "https://web.traceint.com/",
  },
} as const;

export type PresetKey = keyof typeof PRESETS | "custom";

export interface ApiConfig {
  preset: PresetKey;
  apiUrl: string;
  origin: string;
  referer: string;
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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (config: ApiConfig) => void;
}

/**
 * 设置弹窗组件
 * 
 * 支持选择预设配置或自定义 API 参数
 */
export function SettingsModal({ isOpen, onClose, config, onSave }: SettingsModalProps) {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(config);

  // 当 props 变化时同步状态
  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  // 处理预设选择
  const handlePresetChange = (preset: PresetKey) => {
    if (preset === "custom") {
      setLocalConfig({ ...localConfig, preset: "custom" });
    } else {
      setLocalConfig({
        preset,
        ...PRESETS[preset],
      });
    }
  };

  // 处理保存
  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  // 恢复默认
  const handleReset = () => {
    setLocalConfig(DEFAULT_CONFIG);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* 弹窗 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{ x: "-50%", y: "-50%" }}
            className="fixed left-1/2 top-1/2 w-[90%] max-w-md bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl z-50 overflow-hidden border dark:border-neutral-800"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                API 配置
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 预设选择 */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">
                  选择预设
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["ldu", "official", "custom"] as PresetKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => handlePresetChange(key)}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-bold transition-all border-2",
                        localConfig.preset === key
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          : "border-slate-200 bg-slate-50 text-neutral-600 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-slate-400"
                      )}
                    >
                      {key === "ldu" ? "卤蛋大学" : key === "official" ? "官方原版" : "自定义"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义配置输入 */}
              <AnimatePresence>
                {localConfig.preset === "custom" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">
                        API URL
                      </Label>
                      <Input
                        placeholder="https://example.com/index.php/graphql/"
                        value={localConfig.apiUrl}
                        onChange={(e) => setLocalConfig({ ...localConfig, apiUrl: e.target.value })}
                        className="font-mono text-sm dark:border-neutral-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">
                        Origin
                      </Label>
                      <Input
                        placeholder="https://example.com"
                        value={localConfig.origin}
                        onChange={(e) => setLocalConfig({ ...localConfig, origin: e.target.value })}
                        className="font-mono text-sm dark:border-neutral-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">
                        Referer
                      </Label>
                      <Input
                        placeholder="https://example.com/"
                        value={localConfig.referer}
                        onChange={(e) => setLocalConfig({ ...localConfig, referer: e.target.value })}
                        className="font-mono text-sm dark:border-neutral-700"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 当前配置预览 */}
              {localConfig.preset !== "custom" && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-neutral-800/50 space-y-1">
                  <p className="text-xs text-slate-500">
                    <span className="font-bold">API:</span>{" "}
                    <span className="font-mono text-neutral-600 dark:text-slate-400 break-all">
                      {localConfig.apiUrl}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-bold">Origin:</span>{" "}
                    <span className="font-mono text-neutral-600 dark:text-slate-400">
                      {localConfig.origin}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-slate-500"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                恢复默认
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose} className="min-w-[64px]">
                  取消
                </Button>
                <Button size="sm" onClick={handleSave} className="min-w-[64px]">
                  保存
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
