import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";

import { ThemeProvider } from "./components/theme-provider";
import { UpdateDialog } from "./components/UpdateDialog";

import { invoke } from "@tauri-apps/api/core";
import { check, Update } from '@tauri-apps/plugin-updater';

function App() {
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);

  useEffect(() => {
    // 启动画面控制
    const initApp = async () => {
      invoke("close_splashscreen");
    };
    initApp();

    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          console.log(`发现新版本: ${update.version}`);
          setUpdateInfo(update);
        }
      } catch (error) {
        console.error("检查更新失败:", error);
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
