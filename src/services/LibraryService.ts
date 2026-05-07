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
    let derivedOrigin = urlObj.protocol + "//" + urlObj.host;
    let derivedReferer = derivedOrigin + "/web/index.html";

    // 针对「我去图书馆官方版」的识别与跨域头修正
    if (urlObj.host.includes("wechat.v2.traceint.com")) {
      derivedOrigin = "https://web.traceint.com";
      derivedReferer = "https://web.traceint.com/";
    }

    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090719) XWEB/8391 Flue",
      "Referer": referer || derivedReferer,
      "Origin": origin || derivedOrigin,
      "Cookie": cookie,
      "app-version": "2.2.5"
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
  // 明日预约需要展示全部座位
  async getSeatLayout(libId: number, includeOccupied = false): Promise<Seat[]> {
    const query = `query libLayout($libId: Int, $libType: Int) { userAuth { reserve { libs(libType: $libType, libId: $libId) { lib_layout { seats { key name status seat_status type } } } } } }`;
    const data = await this.sendGraphql("libLayout", query, { libId, libType: -1 });
    const seats = data?.data?.userAuth?.reserve?.libs?.[0]?.lib_layout?.seats || [];

    return seats.filter((s: any) => {
      // 过滤掉 name 为空的无效元素
      if (!s.name) return false;
      // 明日预约模式下不过滤占用状态，返回全部座位
      if (includeOccupied) return true;
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
  // includeOccupied 传给 getSeatLayout，确保明日预约时也能解析被占用座位的 Key
  async findSeatKeyByNumber(libId: number, seatNumber: string, includeOccupied = false): Promise<string | null> {
    try {
      const seats = await this.getSeatLayout(libId, includeOccupied);
      const match = seats.find(s => s.name === seatNumber);
      return match ? match.key : null;
    } catch (e) {
      console.error(`[座位解析] 无法解析 ${seatNumber} 的 Key:`, e);
      return null;
    }
  }

  // 5. Book Seat
  async bookSeat(libId: number, seatKey: string, mode: number = 2, captcha = ""): Promise<any> {
    if (mode === 1) {
      // 只有明日预约需要强制排队
      try {
        const wsService = new WebSocketService(this.cookie, this.baseUrl, this.headers["Origin"]);
        console.log("[Booking] 1. Starting WebSocket Queue (Tomorrow Mode)...");
        await wsService.passQueue(mode);
      } catch (e: any) {
        if (e && e.message && e.message.includes("FATAL:")) {
          throw new Error(e.message.replace("FATAL: ", "排队被拦截: "));
        }
        console.warn("[Booking] WebSocket queue bypassed/failed, proceeding to HTTP...", e);
      }
    } else {
      console.log("[Booking] 1. Today Mode: Skipping WebSocket Queue entirely (Not needed).");
    }

    let preflightQuery = "";
    let preflightVars: any = {};
    if (mode === 1) {
      preflightQuery = `query libLayout($libId: Int!) { userAuth { prereserve { libLayout(libId: $libId) { seats_booking seats_total seats_used } } } }`;
      preflightVars = { libId };
    } else {
      preflightQuery = `query libLayout($libId: Int, $libType: Int) { userAuth { reserve { libs(libType: $libType, libId: $libId) { lib_layout { seats_total seats_booking seats_used } } } } }`;
      preflightVars = { libId, libType: -1 };
    }

    try {
      console.log(`[Booking] 2. Pre-flight (Choosing Library for Mode ${mode})...`);
      await this.sendGraphql("libLayout", preflightQuery, preflightVars);
      
      // 添加一个短暂的停顿
      await new Promise(resolve => setTimeout(resolve, 200));
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
      // 官方 Traceint 的 save 接口 key 尾部带一个 '.'
      const isOfficial = this.baseUrl.includes("wechat.v2.traceint.com");
      const finalKey = isOfficial ? seatKey + "." : seatKey;
      const variables = { key: finalKey, libid: libId, captchaCode: "", captcha };
      result = await this.sendGraphql("save", query, variables);
    }

    // 检查响应中的显式错误
    if (result.errors && result.errors.length > 0) {
      return result;
    }

    try {
      console.log("[预约] 4. 正在验证预约结果...");
      let validateQuery = "";
      if (mode === 1) {
        validateQuery = `query prereserve { userAuth { prereserve { prereserve { day lib_id seat_key seat_name is_used } } } }`;
        await this.sendGraphql("prereserve", validateQuery);
      } else {
        validateQuery = `query reserve { userAuth { reserve { reserve { status seat_name lib_name } } } }`;
        await this.sendGraphql("reserve", validateQuery);
      }
    } catch (e) {
      console.warn("[预约] 验证请求失败（非致命网络问题），但主请求已完成。", e);
    }

    return result;
  }
}
