import { useState } from "react";
import { KeyRound, Eye, EyeOff, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CookieFieldProps {
  cookieStr: string;
  onChange: (value: string) => void;
  validating: boolean;
  userInfo: { name: string; valid: boolean } | null;
  onOpenAuth: () => void;
}

export function CookieField({ cookieStr, onChange, validating, userInfo, onOpenAuth }: CookieFieldProps) {
  const [showCookie, setShowCookie] = useState(false);

  return (
    <div className="space-y-3">
      <Label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between dark:text-slate-400">
        <span className="flex items-center gap-2"><KeyRound className="w-3 h-3" /> 身份 Cookie</span>
        {validating && <span className="text-[10px] text-blue-500 animate-pulse">验证中...</span>}
        {!validating && userInfo?.valid && <span className="text-[10px] text-green-500 font-normal">已验证: {userInfo.name}</span>}
        {!validating && userInfo && !userInfo.valid && <span className="text-[10px] text-red-500 font-normal">Cookie 无效</span>}
      </Label>
      <div className="relative">
        <Input
          type={showCookie ? "text" : "password"}
          placeholder="粘贴 Cookie 或使用扫码获取..."
          value={cookieStr}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className={cn(
            "pr-10 h-10 font-mono text-sm transition-colors dark:bg-[rgb(16,16,16)] dark:border-neutral-700",
            userInfo?.valid ? "border-green-500 focus-visible:ring-green-500 bg-green-50/10" :
              (userInfo && !userInfo.valid ? "border-red-500 focus-visible:ring-red-500 bg-red-50/10" : "bg-slate-50 border-slate-200 dark:bg-[rgb(16,16,16)]")
          )}
        />
        <button
          type="button"
          onClick={() => setShowCookie(!showCookie)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-neutral-600 p-1"
        >
          {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <button
        type="button"
        onClick={onOpenAuth}
        className="text-[11px] text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1"
      >
        <QrCode className="w-3 h-3" />
        没有 Cookie？点击扫码获取吧
      </button>
    </div>
  );
}
