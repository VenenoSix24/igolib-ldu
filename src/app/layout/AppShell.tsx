import { Outlet } from "react-router-dom";
import { SideNav } from "./SideNav";
import { Dock } from "./Dock";
import { WallpaperLayer } from "./WallpaperLayer";

/** 2.0 应用壳：桌面 = 侧栏 + 内容区；手机 = 内容区 + 底部 dock */
export function AppShell() {
  return (
    <div className="app-root">
      <WallpaperLayer />
      <div className="mx-auto flex w-full max-w-[1080px] gap-4 px-6 pb-32 pt-7 md:pb-10">
        <SideNav />
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <Outlet />
        </main>
        <Dock />
      </div>
    </div>
  );
}
