import { useEffect, useState } from "react";
import { getDynamicRooms, validateUser, type DynamicRoom, type RoomMapping } from "@/services/api";
import type { ApiConfig } from "@/lib/api-config";

/** 场馆列表 + Cookie 校验：与 1.0 相同的防抖节奏 */
export function useRooms(cookieStr: string, apiConfig: ApiConfig, libId: string, setLibId: (libId: string) => void) {
  const [rooms, setRooms] = useState<RoomMapping>({});
  const [dynamicRooms, setDynamicRooms] = useState<DynamicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [userInfo, setUserInfo] = useState<{ name: string; valid: boolean } | null>(null);
  const [validatingCookie, setValidatingCookie] = useState(false);

  // Cookie 有效性校验（800ms 防抖）
  useEffect(() => {
    setUserInfo(null);
    setValidatingCookie(false);

    async function checkCookie() {
      if (!cookieStr || cookieStr.trim().length < 10) {
        return;
      }
      setValidatingCookie(true);
      try {
        const res = await validateUser(cookieStr.trim(), apiConfig);
        setUserInfo(res.valid ? { name: res.name || "User", valid: true } : { name: "", valid: false });
      } catch {
        setUserInfo({ name: "", valid: false });
      } finally {
        setValidatingCookie(false);
      }
    }
    const timer = setTimeout(checkCookie, 800);
    return () => clearTimeout(timer);
  }, [cookieStr, apiConfig]);

  // Cookie / API 配置变更时刷新场馆列表（500ms 防抖）
  useEffect(() => {
    setLoadingRooms(false);
    setRoomsError(null);
    setDynamicRooms([]);

    async function fetchDynamicRoomsData() {
      if (!cookieStr || cookieStr.trim().length < 10) {
        return;
      }

      setLoadingRooms(true);
      setRoomsError(null);

      try {
        const data = await getDynamicRooms(cookieStr.trim(), apiConfig);
        setDynamicRooms(data.rooms);

        const roomMapping: RoomMapping = {};
        data.rooms.forEach(room => {
          roomMapping[String(room.id)] = room.name;
        });
        setRooms(roomMapping);

        // 如果当前 libId 不在列表中，或者之前没选，就选第一个
        const exists = data.rooms?.some(r => String(r.id) === libId);
        if (!exists && data.rooms?.length > 0) {
          setLibId(String(data.rooms[0].id));
        } else if (data.rooms?.length === 0) {
          setLibId("");
        }
      } catch (error) {
        setRoomsError(error instanceof Error ? error.message : "加载失败");
      } finally {
        setLoadingRooms(false);
      }
    }

    const debounceTimer = setTimeout(fetchDynamicRoomsData, 500);
    return () => clearTimeout(debounceTimer);
    // libId 仅作读取值：选择变更不触发重新请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cookieStr, apiConfig]);

  return { rooms, dynamicRooms, loadingRooms, roomsError, userInfo, validatingCookie };
}
