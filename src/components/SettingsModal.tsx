import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESETS, DEFAULT_CONFIG, type ApiConfig, type PresetKey } from "@/lib/api-config";

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
  const [lastSynced, setLastSynced] = useState<ApiConfig>(config);

  // props 变化时在渲染期同步本地编辑态
  if (config !== lastSynced) {
    setLastSynced(config);
    setLocalConfig(config);
  }

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
            className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.3)] backdrop-blur-[6px] dark:bg-[rgba(2,6,23,0.55)]"
            onClick={onClose}
          />

          {/* 弹窗 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.25, ease: [0.3, 1.15, 0.4, 1] }}
            style={{ x: "-50%" }}
            className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-md overflow-hidden rounded-3xl border border-[var(--gborder)] bg-[var(--glass-3)] shadow-2xl backdrop-blur-2xl"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-[var(--line2)] p-4">
              <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
                <Settings className="h-[18px] w-[18px] text-pri-text dark:text-acc-hi" />
                API 配置
              </h2>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-full p-1.5 text-mut transition-colors hover:bg-[rgba(100,116,139,0.12)] hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 内容 */}
            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
              {/* 预设选择 */}
              <div className="space-y-2">
                <p className="text-[10.5px] font-semibold tracking-wide text-sub">选择预设</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["ldu", "official", "custom"] as PresetKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => handlePresetChange(key)}
                      className={cn(
                        "cursor-pointer rounded-[12px] border px-3 py-2 text-[11.5px] font-bold transition-all",
                        localConfig.preset === key
                          ? "border-[color-mix(in_srgb,var(--pri)_40%,transparent)] bg-[color-mix(in_srgb,var(--pri)_10%,transparent)] text-pri-text dark:text-acc-hi"
                          : "border-[var(--line)] bg-[var(--glass-2)] text-mut hover:border-[color-mix(in_srgb,var(--acc)_45%,transparent)]",
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
                    <div className="field">
                      <label>API URL</label>
                      <input
                        placeholder="https://example.com/index.php/graphql/"
                        value={localConfig.apiUrl}
                        onChange={(e) => setLocalConfig({ ...localConfig, apiUrl: e.target.value })}
                        className="input mono text-[12px]"
                      />
                    </div>
                    <div className="field">
                      <label>Origin</label>
                      <input
                        placeholder="https://example.com"
                        value={localConfig.origin}
                        onChange={(e) => setLocalConfig({ ...localConfig, origin: e.target.value })}
                        className="input mono text-[12px]"
                      />
                    </div>
                    <div className="field">
                      <label>Referer</label>
                      <input
                        placeholder="https://example.com/"
                        value={localConfig.referer}
                        onChange={(e) => setLocalConfig({ ...localConfig, referer: e.target.value })}
                        className="input mono text-[12px]"
                      />
                    </div>
                    <div className="field">
                      <label>微信 AppID</label>
                      <input
                        placeholder="wx..."
                        value={localConfig.wxAppId}
                        onChange={(e) => setLocalConfig({ ...localConfig, wxAppId: e.target.value })}
                        className="input mono text-[12px]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 当前配置预览 */}
              {localConfig.preset !== "custom" && (
                <div className="mono space-y-1 rounded-2xl border border-[var(--line2)] bg-[var(--glass-2)] p-3 text-[11px] text-mut">
                  <p className="break-all">
                    <span className="font-sans font-bold">API: </span>{localConfig.apiUrl}
                  </p>
                  <p>
                    <span className="font-sans font-bold">Origin: </span>{localConfig.origin}
                  </p>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-between border-t border-[var(--line2)] p-4">
              <button type="button" className="btn ghost sm" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" />恢复默认
              </button>
              <div className="flex gap-2">
                <button type="button" className="btn ghost sm min-w-[64px]" onClick={onClose}>取消</button>
                <button type="button" className="btn grad sm min-w-[64px]" onClick={handleSave}>保存</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
