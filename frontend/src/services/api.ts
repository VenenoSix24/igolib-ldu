
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

export async function getMappings(): Promise<{ rooms: RoomMapping }> {
  const response = await fetch('/api/mappings');
  if (!response.ok) {
    throw new Error('Failed to fetch mappings');
  }
  return response.json();
}

export async function submitRequest(request: SeatRequest): Promise<ApiResponse<void>> {
  const response = await fetch('/api/submit_request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Request failed');
  }

  return response.json();
}

export async function cancelTask(clientId: string): Promise<ApiResponse<void>> {
  const response = await fetch(`/api/cancel_task/${clientId}`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error('Failed to cancel task');
  }
  return response.json();
}

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
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cookie,
      apiUrl: apiConfig?.apiUrl || '',
      origin: apiConfig?.origin || '',
      referer: apiConfig?.referer || '',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '获取场馆列表失败');
  }

  return response.json();
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
  const response = await fetch(`/api/rooms/${roomId}/seats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cookie,
      apiUrl: apiConfig?.apiUrl || '',
      origin: apiConfig?.origin || '',
      referer: apiConfig?.referer || '',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || '获取座位布局失败');
  }

  return response.json();
}
