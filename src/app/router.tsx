import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { BookingPage } from "../features/booking/pages/BookingPage";
import { ScannerPage } from "../features/scanner/pages/ScannerPage";
import { RenewalPage } from "../features/renewal/pages/RenewalPage";
import { LogsPage } from "../features/logs/pages/LogsPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";

/** 2.0 路由：/app/* 为新壳；/dashboard（旧）在 S0-8 迁移完成前保留 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/booking" replace />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="booking" replace />} />
        <Route path="booking" element={<BookingPage />} />
        <Route path="scanner" element={<ScannerPage />} />
        <Route path="renewal" element={<RenewalPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
