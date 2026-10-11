import { create } from "zustand";

export interface RuntimeEvent {
  kind: "success" | "error";
  text: string;
  at: number;
}

interface RuntimeState {
  bookingRunning: boolean;
  scanning: boolean;
  renewing: boolean;
  /** 灵动岛顶栏显示的目标上下文（场馆 · 座位） */
  context: string;
  lastEvent: RuntimeEvent | null;
  setBookingRunning: (v: boolean) => void;
  setScanning: (v: boolean) => void;
  setRenewing: (v: boolean) => void;
  setContext: (v: string) => void;
  pushEvent: (kind: RuntimeEvent["kind"], text: string) => void;
}

/** 任务运行态广播：三个循环 hook 发布，灵动岛订阅（不持久化） */
export const useRuntimeStore = create<RuntimeState>()((set) => ({
  bookingRunning: false,
  scanning: false,
  renewing: false,
  context: "",
  lastEvent: null,
  setBookingRunning: (bookingRunning) => set({ bookingRunning }),
  setScanning: (scanning) => set({ scanning }),
  setRenewing: (renewing) => set({ renewing }),
  setContext: (context) => set({ context }),
  pushEvent: (kind, text) => set({ lastEvent: { kind, text, at: Date.now() } }),
}));
