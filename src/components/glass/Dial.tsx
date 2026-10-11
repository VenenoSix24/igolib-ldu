/**
 * 到期表盘：外圈刻度环 + 内圈进度弧（最后 24 小时消耗，>24h 满环）。
 */
export function Dial({
  ratio, tone, label,
}: {
  ratio: number;
  tone: "ok" | "warn" | "err";
  label: string;
}) {
  const R = 24;
  const C = 2 * Math.PI * R;
  const stroke = { ok: "var(--ok)", warn: "var(--warn)", err: "var(--err)" }[tone];
  return (
    <div className="dial">
      <svg viewBox="0 0 62 62" aria-hidden="true">
        <circle cx="31" cy="31" r="28.5" fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="1.5 4.5" />
        <circle cx="31" cy="31" r={R} fill="none" stroke="var(--line2)" strokeWidth="3.5" />
        <circle
          cx="31" cy="31" r={R} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={`${C * ratio} ${C}`} transform="rotate(-90 31 31)"
        />
      </svg>
      <span className="dt">{label}</span>
    </div>
  );
}
