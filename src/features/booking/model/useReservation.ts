import { useCallback, useEffect, useState } from "react";
import { getReservation } from "@/services/api";
import type { ReservationInfo } from "@/services/LibraryService";
import type { ApiConfig } from "@/lib/api-config";
import { useAuthStore, cookieBlocked } from "@/stores/auth";

/** 当前预约查询：页面挂载 / 任务成功后刷新；Cookie 失效时不发请求 */
export function useReservation(cookieStr: string, apiConfig: ApiConfig) {
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!cookieStr || cookieStr.trim().length < 10) {
      setReservation(null);
      return;
    }
    if (cookieBlocked(useAuthStore.getState().cookieStatus)) {
      return;
    }
    setLoading(true);
    try {
      setReservation(await getReservation(cookieStr.trim(), apiConfig));
    } catch {
      setReservation(null);
    } finally {
      setLoading(false);
    }
  }, [cookieStr, apiConfig]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { reservation, loading, refresh };
}
