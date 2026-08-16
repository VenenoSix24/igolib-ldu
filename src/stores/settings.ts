import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CONFIG, type ApiConfig } from "@/lib/api-config";

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
  /** 明日预约模式默认执行时间（HH:MM，可改） */
  defaultExecTime: string;
  /** Cookie 到期提醒提前量（分钟） */
  cookieReminderMinutes: number;
  /** 捡漏扫描间隔下限（秒） */
  scanIntervalSec: number;
  /** 续约取消后等待（秒） */
  renewalDelaySec: number;
  /** 续约触发提前量（分钟，早于签到截止开始续约） */
  renewalLeadMinutes: number;
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
  defaultExecTime: "21:48",
  cookieReminderMinutes: 15,
  scanIntervalSec: 3,
  renewalDelaySec: 60,
  renewalLeadMinutes: 2,
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
      version: 2,
      // v2：prefs 增量字段（如触发提前量）需要回填默认值，避免旧持久化整体覆盖
      migrate: (state) => {
        if (state && typeof state === "object" && "prefs" in state) {
          return { ...state, prefs: { ...DEFAULT_PREFS, ...(state as { prefs?: Partial<FeaturePrefs> }).prefs } };
        }
        return state;
      },
    },
  ),
);
