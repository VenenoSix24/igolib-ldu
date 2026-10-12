import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { check, Update } from "@tauri-apps/plugin-updater";
import { openUrl } from "@tauri-apps/plugin-opener";
import { GlassCard } from "@/components/glass/GlassCard";
import { UpdateDialog } from "@/components/UpdateDialog";
import { cn } from "@/lib/utils";

const HOME_URL = "https://igolib.ivyris.top";
const RELEASES_URL = "https://github.com/VenenoSix24/igolib-ldu/releases";
const ISSUES_URL = "https://github.com/VenenoSix24/igolib-ldu/issues";

const LINKS = [
  { label: "项目主页", url: HOME_URL },
  { label: "更新日志", url: RELEASES_URL },
  { label: "反馈问题", url: ISSUES_URL },
];

function open(url: string) {
  if (isTauri()) void openUrl(url);
  else window.open(url, "_blank");
}

export function AboutPage() {
  const [version, setVersion] = useState("");
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState("");
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (isTauri()) getVersion().then(setVersion).catch(() => {});
  }, []);

  const checkUpdate = async () => {
    setChecking(true);
    setHint("");
    try {
      const found = await check();
      if (found) setUpdate(found);
      else setHint("当前已是最新版本");
    } catch {
      setHint("检查更新失败，请稍后再试");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[19px] font-extrabold tracking-[-0.02em]">关于</h1>

      <GlassCard className="rise mx-auto w-full max-w-[460px] p-5 md:p-6">
        <div className="flex items-center gap-4">
          <img src="/app-icon.png" alt="应用图标" className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-lg" />
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold">我去抢个座</p>
            <p className="mono mt-0.5 text-[11px] text-mut">{version ? `版本 ${version}` : "版本信息不可用（浏览器模式）"}</p>
          </div>
          <button
            type="button"
            className="btn grad sm ml-auto shrink-0"
            disabled={!isTauri() || checking}
            title={isTauri() ? undefined : "仅应用内可用"}
            onClick={() => void checkUpdate()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
            {checking ? "检查中…" : "检查更新"}
          </button>
        </div>
        {hint && <p className="mt-2.5 text-[11.5px] text-mut">{hint}</p>}

        <div className="mt-4 border-t border-[var(--line2)] pt-1">
          {LINKS.map(({ label, url }) => (
            <button
              key={label}
              type="button"
              onClick={() => open(url)}
              className="setrow w-full cursor-pointer text-left"
            >
              <span className="text-[12.5px] font-semibold">{label}</span>
              <span className="sr items-center text-[11px] text-sub">
                {url.replace(/^https:\/\//, "")}
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 border-t border-[var(--line2)] pt-3 text-[10.5px] leading-relaxed text-sub">
          Cookie 仅在本地解析使用，不向第三方上传；预约请求仅发往所选 API 预设的服务端。
        </p>
      </GlassCard>

      <UpdateDialog update={update} onClose={() => setUpdate(null)} />
    </div>
  );
}
