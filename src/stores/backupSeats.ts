import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 备选座位：主选失败后按序尝试 */
export interface BackupSeat {
  key: string;
  name: string;
}

/** 空链常量：selector 直接返回新数组会触发 useSyncExternalStore 无限循环 */
export const EMPTY_BACKUP_CHAIN: BackupSeat[] = [];

interface BackupSeatsState {
  /** 按场馆分组的有序备选链，键为 libId 字符串 */
  chains: Record<string, BackupSeat[]>;
  /** 已在链中则移除，否则追加到末尾 */
  toggle: (libId: string, seat: BackupSeat) => void;
  remove: (libId: string, key: string) => void;
  /** 上移 / 下移（dir = -1 | 1），越界不动 */
  move: (libId: string, key: string, dir: -1 | 1) => void;
  clear: (libId: string) => void;
}

export const useBackupSeatsStore = create<BackupSeatsState>()(
  persist(
    (set) => ({
      chains: {},
      toggle: (libId, seat) =>
        set((s) => {
          const chain = s.chains[libId] ?? [];
          const exists = chain.some((b) => b.key === seat.key);
          return {
            chains: {
              ...s.chains,
              [libId]: exists ? chain.filter((b) => b.key !== seat.key) : [...chain, seat],
            },
          };
        }),
      remove: (libId, key) =>
        set((s) => ({
          chains: { ...s.chains, [libId]: (s.chains[libId] ?? []).filter((b) => b.key !== key) },
        })),
      move: (libId, key, dir) =>
        set((s) => {
          const chain = [...(s.chains[libId] ?? [])];
          const index = chain.findIndex((b) => b.key === key);
          const target = index + dir;
          if (index < 0 || target < 0 || target >= chain.length) return s;
          [chain[index], chain[target]] = [chain[target], chain[index]];
          return { chains: { ...s.chains, [libId]: chain } };
        }),
      clear: (libId) =>
        set((s) => {
          const chains = { ...s.chains };
          delete chains[libId];
          return { chains };
        }),
    }),
    { name: "igolib:backup-seats:v1", version: 1 },
  ),
);
