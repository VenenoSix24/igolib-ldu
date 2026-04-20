import { fetch } from '@tauri-apps/plugin-http';
import { WebSocketService } from './WebSocketService';

interface Room {
  id: number;
  name: string;
  available: number;
}

interface Seat {
  key: string;
  name: string;
  status: boolean;
  type: number;
}

export class LibraryService {
  private baseUrl: string;
  private headers: Record<string, string>;
  private cookie: string;

  constructor(cookie: string, apiUrl: string, origin?: string, referer?: string) {
    this.cookie = cookie;
    this.baseUrl = apiUrl;

    const urlObj = new URL(apiUrl);
    const derivedOrigin = urlObj.protocol + "//" + urlObj.host;
    const derivedReferer = derivedOrigin + "/web/index.html";

    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090719) XWEB/8391 Flue",
      "Referer": referer || derivedReferer,
      "Origin": origin || derivedOrigin,
      "Cookie": cookie
    };

    console.log(`[LibraryService] 初始化: Base=${this.baseUrl}, Origin=${this.headers.Origin}`);
  }

  // 带重试逻辑的通用 GraphQL 发送器
  private async sendGraphql(operationName: string, query: string, variables: any = {}) {
    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[HTTP] 重试第 ${attempt}/${MAX_RETRIES} 次...`);
          // 简单指数退避：500ms, 1000ms, ...
          await new Promise(r => setTimeout(r, 500 * (attempt - 1)));
        }

        // 调试请求头日志
        console.log(`[HTTP] 发送操作: ${operationName}`);
        console.log(`[HTTP] URL: ${this.baseUrl}`);
        // console.log(`[HTTP] Headers:`, this.headers);

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ operationName, query, variables })
        });

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }

        const json = await response.json();
        return json;
      } catch (error) {
        console.error(`[HTTP] 请求失败 (第 ${attempt} 次):`, error);
        lastError = error;
      }
    }
    throw lastError;
  }

  // 1. Get Room List
  async getRoomList(): Promise<Room[]> {
    const query = `query list { userAuth { reserve { libs(libType: -1) { lib_id lib_name is_open lib_rt { seats_has } } } } }`;
    const data = await this.sendGraphql("list", query);
    console.log("[HTTP] list response:", data);
    const libs = data?.data?.userAuth?.reserve?.libs || [];

    // 过滤开放的场馆并映射字段
    console.log("[HTTP] 原始场馆数据:", libs);
    return libs.map((l: any) => ({
      id: l.lib_id,
      name: l.lib_name,
      available: l.lib_rt?.seats_has || 0
    }));
  }

  // 2. Get Seat Layout
  async getSeatLayout(libId: number): Promise<Seat[]> {
    const query = `query libLayout($libId: Int, $libType: Int) { userAuth { reserve { libs(libType: $libType, libId: $libId) { lib_layout { seats { key name status seat_status type } } } } } }`;
    const data = await this.sendGraphql("libLayout", query, { libId, libType: -1 });
    const seats = data?.data?.userAuth?.reserve?.libs?.[0]?.lib_layout?.seats || [];

    return seats.filter((s: any) => {
      const seatStatus = s.seat_status !== undefined ? s.seat_status : 1;
      return seatStatus === 1;
    }).map((s: any) => ({
      key: s.key,
      name: s.name,
      status: s.status,
      type: s.type
    }));
  }

  // 3. Get User Info
  async getUserInfo(): Promise<{ name: string; id: string } | null> {
    try {
      const rooms = await this.getRoomList();
      if (rooms && rooms.length > 0) {
        return { name: "已登录用户", id: "0000" };
      }
      return null;
    } catch (e) {
      console.error("[Auth] Cookie validation failed via room list:", e);
      return null;
    }
  }

  // 4. Find Seat Key by Number
  async findSeatKeyByNumber(libId: number, seatNumber: string): Promise<string | null> {
    try {
      const seats = await this.getSeatLayout(libId);
      const match = seats.find(s => s.name === seatNumber);
      return match ? match.key : null;
    } catch (e) {
      console.error(`[座位解析] 无法解析 ${seatNumber} 的 Key:`, e);
      return null;
    }
  }

  // 5. Book Seat
  async bookSeat(libId: number, seatKey: string, mode: number = 2, captcha = ""): Promise<any> {
    try {
      const wsService = new WebSocketService(this.cookie, this.baseUrl);
      console.log("[Booking] 1. Starting WebSocket Queue (Step 1/2)...");
      await wsService.passQueue(mode);
      console.log("[Booking] 1. Starting WebSocket Queue (Step 2/2)...");
      await wsService.passQueue(mode);
    } catch (e) {
      console.warn("[Booking] WebSocket queue bypassed/failed, proceeding to HTTP...", e);
    }

    const preflightQuery = `query libLayout($libId: Int!) { userAuth { prereserve { libLayout(libId: $libId) { seats_booking seats_total seats_used } } } }`;
    try {
      console.log("[Booking] 2. Pre-flight (Choosing Library)...");
      await this.sendGraphql("libLayout", preflightQuery, { libId });
    } catch (e) {
      console.warn("[Booking] Pre-flight warning (non-fatal):", e);
    }
    console.log("[预约] 3. 正在执行最终预约请求...");
    let result;
    if (mode === 2) {
      // 立即抢座 (Today)
      const query = `mutation reserveSeat($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: String!) { userAuth { reserve { reserveSeat(libId: $libId, seatKey: $seatKey, captchaCode: $captchaCode, captcha: $captcha) } } }`;
      const variables = { libId, seatKey, captchaCode: "", captcha };
      result = await this.sendGraphql("reserveSeat", query, variables);
    } else {
      // 明日预约 (Tomorrow)
      const query = `mutation save($key: String!, $libid: Int!, $captchaCode: String, $captcha: String) { userAuth { prereserve { save(key: $key, libId: $libid, captcha: $captcha, captchaCode: $captchaCode) } } }`;
      const variables = { key: seatKey, libid: libId, captchaCode: "", captcha };
      result = await this.sendGraphql("save", query, variables);
    }

    // 检查响应中的显式错误
    if (result.errors && result.errors.length > 0) {
      return result;
    }

    try {
      console.log("[预约] 4. 正在验证预约结果...");
      const validateQuery = `query prereserve { userAuth { prereserve { prereserve { day lib_id seat_key seat_name is_used } } } }`;
      await this.sendGraphql("prereserve", validateQuery);
    } catch (e) {
      console.warn("[预约] 验证请求失败（网络问题），但主请求已完成。", e);
    }

    return result;
  }
}
