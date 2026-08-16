import { useEffect, useState } from "react";
import { getRoomSeats, type DynamicSeat } from "@/services/api";
import type { ApiConfig } from "@/lib/api-config";
import { useAuthStore, cookieBlocked } from "@/stores/auth";

/** 指定场馆的座位列表：明日模式返回全部，即时模式仅空闲（300ms 防抖） */
export function useSeats(
  cookieStr: string,
  apiConfig: ApiConfig,
  libId: string,
  opMode: "scheduled" | "immediate",
) {
  const [dynamicSeats, setDynamicSeats] = useState<DynamicSeat[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);

  useEffect(() => {
    async function fetchSeatsForRoom() {
      if (!cookieStr || cookieStr.trim().length < 10 || !libId) {
        setDynamicSeats([]);
        return;
      }
      if (cookieBlocked(useAuthStore.getState().cookieStatus)) {
        setDynamicSeats([]);
        return;
      }

      setLoadingSeats(true);
      try {
        // 明日预约模式(mode=1)返回全部座位，今日抢座(mode=2)仅返回空闲
        const mode = opMode === "scheduled" ? 1 : 2;
        const data = await getRoomSeats(parseInt(libId), cookieStr.trim(), apiConfig, mode);
        setDynamicSeats(data.seats.filter(s => s.available));
      } catch {
        setDynamicSeats([]);
      } finally {
        setLoadingSeats(false);
      }
    }

    const debounceTimer = setTimeout(fetchSeatsForRoom, 300);
    return () => clearTimeout(debounceTimer);
  }, [libId, cookieStr, apiConfig, opMode]);

  return { dynamicSeats, loadingSeats };
}
