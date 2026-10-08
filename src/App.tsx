import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";

import { ThemeProvider } from "./components/theme-provider";
import { UpdateDialog } from "./components/UpdateDialog";

import { getVersion } from "@tauri-apps/api/app";
import { fetch } from "@tauri-apps/plugin-http";
import { check, Update } from '@tauri-apps/plugin-updater';

import { createLogger } from "./lib/logger";
import { IS_DEBUG_BUILD } from "./lib/diagnostics";

const log = createLogger("App");

function App() {
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);

  useEffect(() => {
    // Debug 版使用独立的应用标识，若被正式版自动更新覆盖会直接丢掉诊断能力，因此跳过更新检查
    if (IS_DEBUG_BUILD) {
      log.info("Debug 版已跳过更新检查");
      return;
    }

    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          log.info(`发现新版本 (Native): ${update.version}`);
          setUpdateInfo(update);
          return;
        }
      } catch (nativeError) {
        log.warn("原生更新检查失败或不支持，尝试手动检查", nativeError);
      }
      try {
        // 获取当前版本
        const currentVer = await getVersion();

        // 获取远程版本信息
        const response = await fetch("https://cdn.jsdelivr.net/gh/VenenoSix24/igolib-ldu-web@main/public/latest.json", {
          method: 'GET',
          headers: {
            'User-Agent': 'igolib-ldu-updater'
          }
        });

        if (!response.ok) throw new Error("Manifest fetch failed");

        const data = await response.json();
        const latestVer = data.version;

        // 简单的版本比较
        if (latestVer && latestVer !== currentVer) {
          if (latestVer > currentVer) {
            log.info(`发现新版本 (Manual): ${latestVer}`);
            setUpdateInfo({
              version: latestVer,
              body: data.notes,
              isExternal: true,
              downloadUrl: "https://igolib.ivyris.top/#/download"
            } as any);
          }
        }

      } catch (manualError) {
        log.warn("手动更新检查失败", manualError);
      }
    };

    checkForUpdates();
  }, []);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>

      <UpdateDialog
        update={updateInfo}
        onClose={() => setUpdateInfo(null)}
      />
    </ThemeProvider>
  );
}

export default App;
