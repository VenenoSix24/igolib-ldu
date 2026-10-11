import { Outlet } from "react-router-dom";
import { SideNav } from "./SideNav";
import { CookieStatusCard } from "./CookieStatusCard";
import { Dock } from "./Dock";
import { TaskIsland, useIslandVisible } from "./TaskIsland";
import { cn } from "@/lib/utils";

/** 2.0 应用壳：极光雾之上浮玻璃岛。桌面 = 侧栏 + 内容区；手机 = 内容区 + 底部 dock */
export function AppShell() {
  // 灵动岛浮现时内容区下移让位，收起时回落
  const islandVisible = useIslandVisible(1000);

  return (
    <div className="app-root relative min-h-[100dvh]" style={{ background: "var(--bg) fixed" }}>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <TaskIsland />
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-[1080px] gap-4 px-6 pb-32 transition-[padding] duration-300 md:pb-10",
          islandVisible ? "pt-[68px]" : "pt-7",
        )}
      >
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
