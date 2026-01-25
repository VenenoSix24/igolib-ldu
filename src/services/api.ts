
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

// 移除静态 Mappings，改为全动态获取
export async function getMappings(): Promise<{ rooms: RoomMapping }> {
  return { rooms: {} };
}

import { SchedulerService } from './SchedulerService';

// 用于存储活动中断控制器的映射
const activeControllers = new Map<string, AbortController>();

export async function submitRequest(
  request: SeatRequest,
  onStatusUpdate?: (message: string, event?: string, data?: any) => void
): Promise<ApiResponse<void>> {
  const service = new LibraryService(request.cookieStr, request.apiUrl, request.origin, request.referer);

  // 为此请求创建 AbortController
  const controller = new AbortController();
  activeControllers.set(request.clientId, controller);

  try {
    // 检查是否已取消
    if (controller.signal.aborted) throw new Error("Task cancelled");

    // 1. Seat Key Resolution
    if (!request.seatKey) {
      if (request.seatNumber) {
        const msg = `[解析] 正在为您查找座位号 ${request.seatNumber} 的系统标识...`;
        console.log(msg);
        if (onStatusUpdate) onStatusUpdate(msg, "info");
        try {
          // 如果服务方法支持信号，则将信号传递给它们
          const resolvedKey = await service.findSeatKeyByNumber(request.libId, request.seatNumber);

          if (controller.signal.aborted) throw new Error("Task cancelled");

          if (resolvedKey) {
            request.seatKey = resolvedKey;
            const successMsg = `[解析] 座位标识已锁定 (${resolvedKey})`;
            console.log(successMsg);
            if (onStatusUpdate) onStatusUpdate(successMsg, "info");
          } else {
            throw new Error(`无法找到座位号 "${request.seatNumber}" 对应的 Key。请检查座位号是否正确或座位是否开放。`);
          }
        } catch (e: any) {
          throw new Error(`座位解析失败: ${e.message}`);
        }
      } else {
        throw new Error('Seat Key or Seat Number is required');
      }
    }

    // 2. Scheduler
    if (request.timeStr) {
      const msg = `执行时间 ${request.timeStr} 已设定`;
      console.log(msg);
      if (onStatusUpdate) onStatusUpdate(msg, "phase", { phase: "waiting" });

      try {
        await SchedulerService.scheduleTask(request.timeStr, (remaining) => {
          if (controller.signal.aborted) return; // 停止回调

          // 匹配 tasks.py 的日志格式
          if (remaining > 30) {
            const m = Math.floor(remaining / 60);
            const s = Math.floor(remaining % 60);
            // 优化显示格式
            const timeStr = m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
            const msg = `距执行还有 ${timeStr}`;
            console.log(msg);
            if (onStatusUpdate) onStatusUpdate(msg, "countdown", { remaining, phase: "waiting" });
          } else {
            const msg = `即将开始！还剩 ${Math.floor(remaining)} 秒`;
            console.log(msg);
            if (onStatusUpdate) onStatusUpdate(msg, "countdown", { remaining, phase: "countdown" });
          }
        }, controller.signal); // 在此处传递信号

        // 时间已到
        if (onStatusUpdate) onStatusUpdate("时间到，正在执行...", "phase", { phase: "executing" });

      } catch (e: any) {
        if (e.message === "Task cancelled") throw e;
        throw new Error(`Scheduling failed: ${e.message}`);
      }
    }

    // 3. Execution
    if (controller.signal.aborted) throw new Error("Task cancelled");

    try {
      if (onStatusUpdate) onStatusUpdate("正在执行最终预约请求...", "phase", { phase: "reserving" });

      const result = await service.bookSeat(request.libId, request.seatKey as string, request.mode || 2);

      if (result.errors) {
        // 简单错误解析（可以优化以匹配 perform_seat_operation 逻辑）
        const errorMsg = result.errors[0]?.message || result.errors[0]?.msg || 'Booking failed';

        // 类似 core.py 的特定检查
        if (errorMsg.includes("access denied")) {
          throw new Error("Cookie无效或已过期，请更新。");
        }
        if (errorMsg.includes("这一天不开放")) {
          throw new Error("操作失败: 该日期不开放预约");
        }
        if (errorMsg.includes("被预约") || errorMsg.includes("被人预定")) {
          throw new Error("操作失败: 手慢了，座位已被抢占");
        }

        throw new Error(`操作失败: ${errorMsg}`);
      }
      return { status: "success", message: "Booking successful", data: undefined };
    } catch (e: any) {
      throw new Error(e.message || 'Booking request failed');
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
    console.log(`[Task] Cancelled task ${clientId}`);
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

/**
 * 动态获取场馆列表（需要有效 Cookie）
 * @param cookie 用户 Cookie
 * @param apiConfig API 配置参数（可选）
 */
export async function getDynamicRooms(
  cookie: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string }
): Promise<{ rooms: DynamicRoom[]; total: number }> {
  const service = new LibraryService(cookie, apiConfig?.apiUrl, apiConfig?.origin, apiConfig?.referer);
  const rawRooms = await service.getRoomList();

  const rooms: DynamicRoom[] = rawRooms.map(r => ({
    id: r.id,
    name: r.name,
    floor: "3", // 默认楼层，实际应从API获取或后续完善
    isOpen: true,
    seatsTotal: r.available, // 暂时用 available 填充 (数据缺失)
    seatsUsed: 0,
    seatsAvailable: r.available,
    openTime: "08:00",
    closeTime: "22:00"
  }));

  return { rooms, total: rooms.length };
}

/**
 * 动态获取指定场馆的座位布局（需要有效 Cookie）
 * @param roomId 场馆 ID
 * @param cookie 用户 Cookie  
 * @param apiConfig API 配置参数（可选）
 */
export async function getRoomSeats(
  roomId: number,
  cookie: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string }
): Promise<SeatLayoutResponse> {
  const service = new LibraryService(cookie, apiConfig?.apiUrl, apiConfig?.origin, apiConfig?.referer);
  const rawSeats = await service.getSeatLayout(roomId);

  const seats: DynamicSeat[] = rawSeats.map(s => ({
    key: s.key,
    name: s.name,
    status: 1, // Default visible status
    available: true // Python logic: all visible seats are locally valid targets
  }));

  const seatMapping: { [name: string]: string } = {};
  seats.forEach(s => {
    seatMapping[s.name] = s.key;
  });

  return {
    roomId,
    roomName: "阅览室", // 动态获取场景下，名称通常由调用方已知或从其他 API 获取
    seats,
    seatMapping
  };
}

export async function validateUser(
  cookie: string,
  apiConfig?: { apiUrl?: string; origin?: string; referer?: string }
): Promise<{ valid: boolean; name?: string }> {
  try {
    const service = new LibraryService(cookie, apiConfig?.apiUrl, apiConfig?.origin, apiConfig?.referer);
    const info = await service.getUserInfo();
    if (info) {
      return { valid: true, name: info.name };
    }
    return { valid: false };
  } catch (e) {
    return { valid: false };
  }
}
