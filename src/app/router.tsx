import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { HomePage } from "../features/home/pages/HomePage";
import { TomorrowPage } from "../features/booking/pages/TomorrowPage";
import { GrabPage } from "../features/booking/pages/GrabPage";
import { ScannerPage } from "../features/scanner/pages/ScannerPage";
import { RenewalPage } from "../features/renewal/pages/RenewalPage";

/** 2.0 路由：/app/* 为新壳；/dashboard（旧）在功能页迁移完成前保留 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/home" replace />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="tomorrow" element={<TomorrowPage />} />
        <Route path="grab" element={<GrabPage />} />
        <Route path="scanner" element={<ScannerPage />} />
        <Route path="renewal" element={<RenewalPage />} />
      </Route>
      {/* 未知路径兜底回首页，避免 No routes matched 警告 */}
      <Route path="*" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
}
