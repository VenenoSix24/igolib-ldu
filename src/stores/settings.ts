import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CONFIG, type ApiConfig } from "@/components/SettingsModal";

export type OpMode = "scheduled" | "immediate";
export type ExecTime = "immediate" | "2148" | "custom";

/** 预约相关：对应 1.0 Dashboard 的散落 localStorage key */
export interface BookingState {
  cookieStr: string;
  libId: string;
  seatNumber: string;
  opMode: OpMode;
  execTime: ExecTime;
  customTime: string;
}

/** 2.0 新增功能参数，页面接入前仅作为默认值存放 */
export interface FeaturePrefs {
  /** Cookie 到期提醒提前量（分钟） */
  cookieReminderMinutes: number;
  /** 捡漏扫描间隔下限（秒） */
  scanIntervalSec: number;
  /** 续约取消后等待（秒） */
  renewalDelaySec: number;
  /** LDU 预约失败时换官方 mutation 名重试 */
  lduFallbackEnabled: boolean;
}

interface SettingsState {
  api: ApiConfig;
  booking: BookingState;
  prefs: FeaturePrefs;
  setApi: (api: Partial<ApiConfig>) => void;
  setBooking: (patch: Partial<BookingState>) => void;
  setPrefs: (patch: Partial<FeaturePrefs>) => void;
}

const DEFAULT_BOOKING: BookingState = {
  cookieStr: "",
  libId: "",
  seatNumber: "",
  opMode: "scheduled",
  execTime: "2148",
  customTime: "",
};

const DEFAULT_PREFS: FeaturePrefs = {
  cookieReminderMinutes: 15,
  scanIntervalSec: 3,
  renewalDelaySec: 60,
  lduFallbackEnabled: false,
};

/**
 * 首次启动时把 1.0 的散 key 收编进 store。
 * 只读取不回写、不删除，1.0 页面在新 store 落地前仍可正常工作。
 */
function collectLegacyState(): { api: ApiConfig; booking: BookingState } {
  const booking: BookingState = { ...DEFAULT_BOOKING };
  try {
    const legacyStr = (key: string) => localStorage.getItem(key) ?? "";

    const apiJson = localStorage.getItem("igolib_api_config");
    const api: ApiConfig = apiJson
      ? { ...DEFAULT_CONFIG, ...JSON.parse(apiJson) }
      : DEFAULT_CONFIG;

    const cookieStr = legacyStr("cookieStr");
    const libId = legacyStr("libId");
    const seatNumber = legacyStr("seatNumber");
    const opMode = legacyStr("opMode") as OpMode;
    const execTime = legacyStr("execTime") as ExecTime;
    const customTime = legacyStr("customTime");

    return {
      api,
      booking: {
        cookieStr,
        libId,
        seatNumber,
        opMode: opMode === "immediate" ? "immediate" : "scheduled",
        execTime:
          execTime === "immediate" || execTime === "custom" ? execTime : "2148",
        customTime,
      },
    };
  } catch {
    return { api: DEFAULT_CONFIG, booking };
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => {
      // 初始化读一次旧 key；已有持久化时 rehydrate 会覆盖为存储值
      const legacy = collectLegacyState();
      return {
        api: legacy.api,
        booking: legacy.booking,
        prefs: DEFAULT_PREFS,
        setApi: (api) => set((s) => ({ api: { ...s.api, ...api } })),
        setBooking: (patch) => set((s) => ({ booking: { ...s.booking, ...patch } })),
        setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      };
    },
    {
      name: "igolib:settings:v1",
      version: 1,
    },
  ),
);
