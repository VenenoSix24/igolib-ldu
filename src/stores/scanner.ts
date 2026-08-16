import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 捡漏监控的场馆（有序，先扫描前面的） */
export interface ScannerVenue {
  libId: string;
  name: string;
}

/** 命中记录：发现空位 / 自动预约的结果 */
export interface ScannerHit {
  id: string;
  time: number;
  libId: string;
  libName: string;
  seatName?: string;
  message: string;
  /** booked = 已自动预约；found = 仅发现空位 */
  kind: "found" | "booked" | "failed";
}

const MAX_HITS = 50;

interface ScannerState {
  venues: ScannerVenue[];
  hits: ScannerHit[];
  /** 勾选 / 取消勾选场馆（取消时同时移出序列） */
  toggleVenue: (venue: ScannerVenue) => void;
  removeVenue: (libId: string) => void;
  /** 上移 / 下移（dir = -1 | 1），越界不动 */
  moveVenue: (libId: string, dir: -1 | 1) => void;
  clearVenues: () => void;
  pushHit: (hit: Omit<ScannerHit, "id" | "time">) => void;
  clearHits: () => void;
}

export const useScannerStore = create<ScannerState>()(
  persist(
    (set) => ({
      venues: [],
      hits: [],
      toggleVenue: (venue) =>
        set((s) => {
          const exists = s.venues.some((v) => v.libId === venue.libId);
          return {
            venues: exists
              ? s.venues.filter((v) => v.libId !== venue.libId)
              : [...s.venues, venue],
          };
        }),
      removeVenue: (libId) =>
        set((s) => ({ venues: s.venues.filter((v) => v.libId !== libId) })),
      moveVenue: (libId, dir) =>
        set((s) => {
          const venues = [...s.venues];
          const index = venues.findIndex((v) => v.libId === libId);
          const target = index + dir;
          if (index < 0 || target < 0 || target >= venues.length) return s;
          [venues[index], venues[target]] = [venues[target], venues[index]];
          return { venues };
        }),
      clearVenues: () => set({ venues: [] }),
      pushHit: (hit) =>
        set((s) => ({
          hits: [{ ...hit, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, time: Date.now() }, ...s.hits].slice(0, MAX_HITS),
        })),
      clearHits: () => set({ hits: [] }),
    }),
    { name: "igolib:scanner:v1", version: 1 },
  ),
);

/**
 * 扫描循环的停止通道：抢座任务成功后由预约页调用，
 * 循环侧注册回调后即可自动停掉同场馆的扫描（跨 feature 通信走 store 层）。
 */
let loopStopper: ((libId: string) => void) | null = null;

export function registerScannerLoopStopper(fn: ((libId: string) => void) | null) {
  loopStopper = fn;
}

/** 抢座任务成功后调用：自动停止扫描同场馆的捡漏循环 */
export function notifyBookingSuccess(libId: string) {
  loopStopper?.(libId);
}
