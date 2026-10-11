import { Outlet } from "react-router-dom";
import { SideNav } from "./SideNav";
import { CookieStatusCard } from "./CookieStatusCard";
import { Dock } from "./Dock";

/** 2.0 应用壳：极光雾之上浮玻璃岛。桌面 = 侧栏 + 内容区；手机 = 内容区 + 底部 dock */
export function AppShell() {
  return (
    <div className="app-root relative min-h-[100dvh]" style={{ background: "var(--bg) fixed" }}>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="relative z-10 mx-auto flex w-full max-w-[1080px] gap-4 px-6 pb-32 pt-7 md:pb-10">
        <div className="hidden w-[200px] shrink-0 flex-col gap-3 md:sticky md:top-7 md:flex md:self-start">
          <SideNav />
          <CookieStatusCard />
        </div>
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <Outlet />
        </main>
        <Dock />
      </div>
    </div>
  );
}
