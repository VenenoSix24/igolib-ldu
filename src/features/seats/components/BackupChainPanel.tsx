import { ArrowDown, ArrowUp, ListOrdered, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { useBackupSeatsStore, EMPTY_BACKUP_CHAIN } from "@/stores/backupSeats";

/**
 * 备选链卡片：主选失败后按序尝试的座位列表，可排序 / 移除。
 */
export function BackupChainPanel({ libId, className }: { libId: string; className?: string }) {
  const chain = useBackupSeatsStore((s) => s.chains[libId] ?? EMPTY_BACKUP_CHAIN);
  const { move, remove, clear } = useBackupSeatsStore.getState();

  if (!libId) return null;

  return (
    <GlassCard className={cn("rise p-4 md:p-5", className)}>
      <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-sub">
        <ListOrdered className="h-3.5 w-3.5" />备选链
        <span className="font-normal">（主选失败后按序尝试）</span>
        {chain.length > 0 && (
          <button
            type="button"
            onClick={() => clear(libId)}
            className="ml-auto cursor-pointer text-[10.5px] transition-colors hover:text-err"
          >
            清空
          </button>
        )}
      </div>
      {chain.length === 0 ? (
        <p className="py-1 text-center text-[11px] text-sub">
          在网格中长按 / 右键座位即可加入备选
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {chain.map((seat, i) => (
            <li
              key={seat.key}
              className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--acc)_35%,transparent)] bg-[color-mix(in_srgb,var(--acc)_12%,transparent)] px-2.5 py-1.5"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--glass-3)] text-[10px] font-extrabold text-ink">
                {i + 1}
              </span>
              <span className="mono flex-1 text-[12px] font-bold text-pri-text dark:text-acc-hi">{seat.name} 号</span>
              <span className="flex gap-0.5">
                <button
                  type="button"
                  aria-label={`上移备选 ${seat.name}`}
                  disabled={i === 0}
                  onClick={() => move(libId, seat.key, -1)}
                  className="cursor-pointer rounded-md p-1 text-sub transition-colors hover:bg-[var(--glass-3)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`下移备选 ${seat.name}`}
                  disabled={i === chain.length - 1}
                  onClick={() => move(libId, seat.key, 1)}
                  className="cursor-pointer rounded-md p-1 text-sub transition-colors hover:bg-[var(--glass-3)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`移除备选 ${seat.name}`}
                  onClick={() => remove(libId, seat.key)}
                  className="cursor-pointer rounded-md p-1 text-sub transition-colors hover:bg-[rgba(244,63,94,0.1)] hover:text-err"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}
