import { createLogger } from '@/lib/logger';

const apiLog = createLogger("Task");

export interface RoomMapping {
  [id: string]: string;
}

export interface SeatRequest {
  clientId: string;
  libId: number;
  seatNumber: string;
  mode: number; // 1 = 预约模式, 2 = 即时模式
  timeStr: string;
  cookieStr: string;
  seatKey?: string;
  /** 备选链：主选失败（座位被占等）时按序尝试 */
  backupSeats?: { key: string; name: string }[];
  // API 配置参数
  apiUrl?: string;
  origin?: string;
  referer?: string;
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data?: T;
}

// 全动态获取
export async function getMappings(): Promise<{ rooms: RoomMapping }> {
  return { rooms: {} };
}

import { SchedulerService } from './SchedulerService';

// 用于存储活动中断控制器的映射
const activeControllers = new Map<string, AbortController>();

export async function submitRequest(
  request: SeatRequest,
  onStatusUpdate?: (message: string, event?: string, data?: Record<string, unknown>) => void
): Promise<ApiResponse<void>> {
  const apiUrl = request.apiUrl || DEFAULT_API_CONFIG.apiUrl;
  const service = new LibraryService(request.cookieStr, apiUrl, request.origin, request.referer);

  // 为此请求创建 AbortController
  const controller = new AbortController();
  activeControllers.set(request.clientId, controller);

  try {
    // 检查是否已取消
    if (controller.signal.aborted) throw new Error("Task cancelled");

    if (!request.seatKey) {
      if (request.seatNumber) {
        const msg = `[解析] 正在为您查找座位号 ${request.seatNumber} 的系统标识...`;
        apiLog.info(msg);
        if (onStatusUpdate) onStatusUpdate(msg, "info");
        try {
          // 明日预约模式(mode=1)需要包含今日被占用的座位，否则解析不到 Key
          const includeOccupied = request.mode === 1;
          const resolvedKey = await service.findSeatKeyByNumber(request.libId, request.seatNumber, includeOccupied);

          if (controller.signal.aborted) throw new Error("Task cancelled");

          if (resolvedKey) {
            request.seatKey = resolvedKey;
            const successMsg = `[解析] 座位标识已锁定 (${resolvedKey})`;
            apiLog.info(successMsg);
            if (onStatusUpdate) onStatusUpdate(successMsg, "info");
          } else {
            throw new Error(`无法找到座位号 "${request.seatNumber}" 对应的 Key。请检查座位号是否正确或座位是否开放。`);
          }
        } catch (e) {
          throw new Error(`座位解析失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        throw new Error('Seat Key or Seat Number is required');
      }
    }

    if (request.timeStr) {
      const msg = `执行时间 ${request.timeStr} 已设定`;
      apiLog.info(msg);
      if (onStatusUpdate) onStatusUpdate(msg, "phase", { phase: "waiting" });

      try {
        await SchedulerService.scheduleTask(request.timeStr, (remaining) => {
          if (controller.signal.aborted) return; // 停止回调

          if (remaining > 30) {
            const m = Math.floor(remaining / 60);
            const s = Math.floor(remaining % 60);
            // 优化显示格式
            const timeStr = m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
            const msg = `距执行还有 ${timeStr}`;
            apiLog.info(msg);
            if (onStatusUpdate) onStatusUpdate(msg, "countdown", { remaining, phase: "waiting" });
          } else {
            const msg = `即将开始！还剩 ${Math.floor(remaining)} 秒`;
            apiLog.info(msg);
            if (onStatusUpdate) onStatusUpdate(msg, "countdown", { remaining, phase: "countdown" });
          }
        }, controller.signal); // 在此处传递信号

        // 时间已到
        if (onStatusUpdate) onStatusUpdate("时间到，正在执行...", "phase", { phase: "executing" });

      } catch (e) {
        if (e instanceof Error && e.message === "Task cancelled") throw e;
        throw new Error(`Scheduling failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (controller.signal.aborted) throw new Error("Task cancelled");

    try {
      if (onStatusUpdate) onStatusUpdate("正在执行最终预约请求...", "phase", { phase: "reserving" });

      // 候选链：主选在前，备选按序在后
      const candidates: { key: string; label: string }[] = [
        { key: request.seatKey as string, label: request.seatNumber },
        ...(request.backupSeats ?? []).map((b) => ({ key: b.key, label: b.name })),
      ];

      let lastError: Error = new Error("Booking request failed");
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const result = await service.bookSeat(request.libId, candidate.key, request.mode || 2);

        if (!result.errors) {
          if (i > 0 && onStatusUpdate) {
            onStatusUpdate(`[备选] 已改用备选座位 ${candidate.label} 完成预约`, "success");
          }
          return { status: "success", message: "Booking successful", data: undefined };
        }

        // 简单错误解析
        const errorMsg = result.errors[0]?.message || result.errors[0]?.msg || 'Booking failed';

        if (errorMsg.includes("access denied")) {
          throw new Error("Cookie无效或已过期，请更新。");
        }
        if (errorMsg.includes("这一天不开放")) {
          throw new Error("操作失败: 该日期不开放预约");
        }
        if (errorMsg.includes("被预约") || errorMsg.includes("被人预定")) {
          lastError = new Error(`操作失败: 座位 ${candidate.label} 已被抢占`);
        } else {
          lastError = new Error(`操作失败: ${errorMsg}`);
        }

        const hasNext = i < candidates.length - 1;
        if (hasNext && onStatusUpdate) {
          onStatusUpdate(`[备选] 座位 ${candidate.label} 失败（${lastError.message}），尝试下一个备选…`, "warn");
        } else {
          throw lastError;
        }
      }
      throw lastError;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Booking request failed');
    }
  } finally {
    // 清理
    activeControllers.delete(request.clientId);
  }
}

export async function cancelTask(clientId: string): Promise<ApiResponse<void>> {
  const controller = activeControllers.get(clientId);
  if (controller) {
    controller.abort();
    activeControllers.delete(clientId);
    apiLog.info(`已取消任务 ${clientId}`);
    return { status: "success", message: "Task cancelled", data: undefined };
  }
  return { status: "warning", message: "Task not found or already finished", data: undefined };
}

import { LibraryService } from './LibraryService';

// --- 动态数据获取 API ---

/**
 * 动态场馆信息
 */
export interface DynamicRoom {
  id: number;
  name: string;
  floor: string;
  isOpen: boolean;
  seatsTotal: number;
  seatsUsed: number;
  seatsAvailable: number;
  openTime: string;
  closeTime: string;
}

/**
 * 动态座位信息
 */
export interface DynamicSeat {
  key: string;
  name: string;
  status: number;
  available: boolean;
  /** 布局坐标（无坐标数据时为 0，网格按序排布） */
  x: number;
  y: number;
}

/**
 * 座位布局响应
 */
export interface SeatLayoutResponse {
  roomId: number;
  roomName: string;
  seats: DynamicSeat[];
  seatMapping: { [name: string]: string };
}

const DEFAULT_API_CONFIG = {
  apiUrl: "https://libseats.ldu.edu.cn/index.php/graphql/",
  origin: "https://libseats.ldu.edu.cn",
  referer: "https://libseats.ldu.edu.cn/web/index.html"
};

/**
 * 动态获取场馆列表（需要有效 Cookie）
 */
export async function getDynamicRooms(
  cookie: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string }
): Promise<{ rooms: DynamicRoom[]; total: number }> {
  const apiUrl = apiConfig?.apiUrl || DEFAULT_API_CONFIG.apiUrl;
  const service = new LibraryService(cookie, apiUrl, apiConfig?.origin, apiConfig?.referer);
  const rawRooms = await service.getRoomList();

  const rooms: DynamicRoom[] = rawRooms.map(r => ({
    id: r.id,
    name: r.name,
    floor: r.name.match(/\d+/)?.at(0) || "1",
    isOpen: r.isOpen,
    seatsTotal: r.available,
    seatsUsed: 0,
    seatsAvailable: r.available,
    openTime: "08:00",
    closeTime: "22:00"
  }));

  return { rooms, total: rooms.length };
}

/**
 * 动态获取指定场馆的座位布局（需要有效 Cookie）
 * @param mode 预约模式：1=明日预约（返回全部座位），2=今日抢座（仅返回空闲座位）
 */
export async function getRoomSeats(
  roomId: number,
  cookie: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string },
  mode: number = 2
): Promise<SeatLayoutResponse> {
  const apiUrl = apiConfig?.apiUrl || DEFAULT_API_CONFIG.apiUrl;
  const service = new LibraryService(cookie, apiUrl, apiConfig?.origin, apiConfig?.referer);
  const includeOccupied = mode === 1;
  const rawSeats = await service.getSeatLayout(roomId, includeOccupied);

  const seats: DynamicSeat[] = rawSeats.map(s => ({
    key: s.key,
    name: s.name,
    status: 1,
    available: s.seatStatus === 1,
    x: s.x,
    y: s.y
  }));

  const seatMapping: { [name: string]: string } = {};
  seats.forEach(s => {
    seatMapping[s.name] = s.key;
  });

  return {
    roomId,
    roomName: "阅览室",
    seats,
    seatMapping
  };
}

export async function validateUser(
  cookie: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string }
): Promise<{ valid: boolean; name?: string }> {
  try {
    const apiUrl = apiConfig?.apiUrl || DEFAULT_API_CONFIG.apiUrl;
    const service = new LibraryService(cookie, apiUrl, apiConfig?.origin, apiConfig?.referer);
    const info = await service.getUserInfo();
    if (info) {
      return { valid: true, name: info.name };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * 查询当前预约（座位 / 时段 / 签到截止 / sToken）
 */
export async function getReservation(
  cookie: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string }
): Promise<import('./LibraryService').ReservationInfo | null> {
  const apiUrl = apiConfig?.apiUrl || DEFAULT_API_CONFIG.apiUrl;
  const service = new LibraryService(cookie, apiUrl, apiConfig?.origin, apiConfig?.referer);
  return service.getReservation();
}

/**
 * 取消当前预约。兼容模式下 mutation 名不被识别时自动换名重试一次。
 */
export async function cancelReservation(
  cookie: string,
  sToken: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string },
  lduFallback = false
): Promise<{ success: boolean; message: string }> {
  const apiUrl = apiConfig?.apiUrl || DEFAULT_API_CONFIG.apiUrl;
  const service = new LibraryService(cookie, apiUrl, apiConfig?.origin, apiConfig?.referer);

  const result = await service.cancelReservation(sToken);
  if (!result.errors) return { success: true, message: "预约已取消" };

  // code 1 = mutation 不被识别（命名不一致）
  if (lduFallback && result.errors.some((e) => e.code === 1)) {
    apiLog.warn("取消接口名不被识别，尝试备选命名 reserveCancel...");
    const retry = await service.cancelReservation(sToken, true);
    if (!retry.errors) return { success: true, message: "预约已取消（兼容模式）" };
    return { success: false, message: retry.errors[0]?.message || retry.errors[0]?.msg || "取消失败" };
  }
  return { success: false, message: result.errors[0]?.message || result.errors[0]?.msg || "取消失败" };
}
