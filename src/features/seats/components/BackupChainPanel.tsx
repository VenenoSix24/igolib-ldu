import { ArrowDown, ArrowUp, ListOrdered, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackupSeatsStore, EMPTY_BACKUP_CHAIN } from "@/stores/backupSeats";

/**
 * 备选链面板：主选失败后按序尝试的座位列表，可排序 / 移除。
 */
export function BackupChainPanel({ libId, className }: { libId: string; className?: string }) {
  const chain = useBackupSeatsStore((s) => s.chains[libId] ?? EMPTY_BACKUP_CHAIN);
  const { move, remove, clear } = useBackupSeatsStore.getState();

  if (!libId) return null;

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]", className)}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-wider text-slate-500 dark:text-slate-300">
        <ListOrdered className="h-3.5 w-3.5" />备选链
        <span className="text-[10px] font-normal">（主选失败后按序尝试）</span>
        {chain.length > 0 && (
          <button
            type="button"
            onClick={() => clear(libId)}
            className="ml-auto cursor-pointer text-[10.5px] text-slate-400 transition-colors hover:text-red-500"
          >
            清空
          </button>
        )}
      </div>
      {chain.length === 0 ? (
        <p className="py-1 text-center text-[11px] text-slate-400">
          在网格中长按 / 右键座位即可加入备选
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {chain.map((seat, i) => (
            <li
              key={seat.key}
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/25 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                {i + 1}
              </span>
              <span className="flex-1 font-mono text-[12px] font-bold text-amber-800 dark:text-amber-200">{seat.name} 号</span>
              <span className="flex gap-0.5">
                <button
                  type="button"
                  aria-label={`上移备选 ${seat.name}`}
                  disabled={i === 0}
                  onClick={() => move(libId, seat.key, -1)}
                  className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`下移备选 ${seat.name}`}
                  disabled={i === chain.length - 1}
                  onClick={() => move(libId, seat.key, 1)}
                  className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-slate-200"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`移除备选 ${seat.name}`}
                  onClick={() => remove(libId, seat.key)}
                  className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
