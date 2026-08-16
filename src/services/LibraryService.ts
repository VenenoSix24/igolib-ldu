import { fetch } from '@tauri-apps/plugin-http';
import { createLogger } from '@/lib/logger';

const httpLog = createLogger("HTTP");
const bookingLog = createLogger("Booking");
const reserveLog = createLogger("预约");
import { WebSocketService } from './WebSocketService';

interface Room {
  id: number;
  name: string;
  available: number;
  isOpen: boolean;
}

interface Seat {
  key: string;
  name: string;
  status: boolean;
  type: number;
  x: number;
  y: number;
  seatStatus: number;
}

interface RawSeat {
  key: string;
  name: string;
  status: boolean;
  type: number;
  seat_status?: number;
  x?: number;
  y?: number;
}

interface RawLib {
  lib_id: number;
  lib_name: string;
  is_open?: number | boolean;
  lib_rt?: { seats_has?: number };
  lib_layout?: { seats?: RawSeat[] };
}

interface GqlError {
  message?: string;
  msg?: string;
  code?: number;
}

interface GqlResponse {
  data?: {
    userAuth?: {
      reserve?: {
        libs?: RawLib[];
        reserveSeat?: boolean;
        reserueSeat?: boolean;
        reserveCancle?: boolean;
        reserveCancel?: boolean;
        reserve?: RawReservation;
      };
      prereserve?: {
        libLayout?: { seats_booking?: number; seats_total?: number; seats_used?: number };
        save?: boolean;
      };
    };
  };
  errors?: GqlError[];
}

/** 当前预约信息（query index 的 reserve 字段） */
export interface ReservationInfo {
  status?: number;
  libName?: string;
  seatName?: string;
  stime?: string;
  etime?: string;
  tmsg?: string;
  sToken?: string;
  /** 签到截止 */
  validateDate?: string;
  holdDate?: string;
  /** 为真时禁止取消 */
  forbidWechatCancle?: boolean;
}

interface RawReservation {
  status?: number;
  lib_name?: string;
  seat_name?: string;
  stime?: string;
  etime?: string;
  tmsg?: string;
  getSToken?: string;
  validate_date?: string;
  hold_date?: string;
  forbidWechatCancle?: boolean;
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

    httpLog.info(`LibraryService 初始化: Base=${this.baseUrl}, Origin=${this.headers.Origin}`);
  }

  // 带超时与重试逻辑的通用 GraphQL 发送器
  private async sendGraphql(operationName: string, query: string, variables: Record<string, unknown> = {}): Promise<GqlResponse> {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 8000;
    let lastError: Error = new Error("请求失败");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          httpLog.info(`重试第 ${attempt}/${MAX_RETRIES} 次...`);
          // 简单指数退避：500ms, 1000ms, ...
          await new Promise(r => setTimeout(r, 500 * (attempt - 1)));
        }

        // 调试请求头日志
        httpLog.debug(`发送操作: ${operationName}`);
        httpLog.debug(`URL: ${this.baseUrl}`);
        const loggedHeaders = { ...this.headers, Cookie: this.headers.Cookie ? `${this.headers.Cookie.slice(0, 16)}...(len=${this.headers.Cookie.length})` : "" };
        httpLog.debug(`Headers:`, loggedHeaders);
        httpLog.debug(`Variables:`, variables);

        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ operationName, query, variables }),
            signal: timeoutController.signal
          });
        } catch (error) {
          // 网络层失败或超时：可重试
          throw { retryable: true, error };
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          // 5xx 视为临时故障可重试；4xx 是请求本身的问题，重试无意义
          throw { retryable: response.status >= 500, error: new Error(`HTTP Error: ${response.status} ${response.statusText}`) };
        }

        const json = await response.json();
        httpLog.debug(`${operationName} 响应:`, json);
        return json;
      } catch (failure) {
        const retryable = (failure as { retryable?: boolean }).retryable === true;
        const error = (failure as { error?: unknown }).error ?? failure;
        lastError = error instanceof Error ? error : new Error(String(error));
        httpLog.error(`请求失败 (第 ${attempt} 次)${retryable ? "" : "（不可重试）"}:`, lastError);
        if (!retryable) break;
      }
    }
    throw lastError;
  }

  // 1. Get Room List
  async getRoomList(): Promise<Room[]> {
    const query = `query list { userAuth { reserve { libs(libType: -1) { lib_id lib_name is_open lib_rt { seats_has } } } } }`;
    const data = await this.sendGraphql("list", query);
    httpLog.debug("list response:", data);
    const libs = data?.data?.userAuth?.reserve?.libs || [];

    // 过滤开放的场馆并映射字段
    httpLog.debug("原始场馆数据:", libs);
    return libs.map((l) => ({
      id: l.lib_id,
      name: l.lib_name,
      available: l.lib_rt?.seats_has || 0,
      isOpen: l.is_open !== 0 && l.is_open !== false
    }));
  }

  // 2. Get Seat Layout
  // 明日预约需要展示全部座位
  async getSeatLayout(libId: number, includeOccupied = false): Promise<Seat[]> {
    const query = `query libLayout($libId: Int, $libType: Int) { userAuth { reserve { libs(libType: $libType, libId: $libId) { lib_layout { seats { key name status seat_status type x y } } } } } }`;
    const data = await this.sendGraphql("libLayout", query, { libId, libType: -1 });
    const seats = data?.data?.userAuth?.reserve?.libs?.[0]?.lib_layout?.seats || [];

    return seats.filter((s) => {
      // 过滤掉 name 为空的无效元素
      if (!s.name) return false;
      // 明日预约模式下不过滤占用状态，返回全部座位
      if (includeOccupied) return true;
      const seatStatus = s.seat_status !== undefined ? s.seat_status : 1;
      return seatStatus === 1;
    }).map((s) => ({
      key: s.key,
      name: s.name,
      status: s.status,
      type: s.type,
      x: s.x ?? 0,
      y: s.y ?? 0,
      seatStatus: s.seat_status !== undefined ? s.seat_status : 1
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
      httpLog.error("Cookie 校验失败（通过场馆列表探测）:", e);
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
      httpLog.error(`无法解析 ${seatNumber} 的 Key:`, e);
      return null;
    }
  }

  // 5. Get Current Reservation (query index)
  async getReservation(): Promise<ReservationInfo | null> {
    const query = `query index { userAuth { reserve { reserve { status stime etime lib_name seat_name tmsg getSToken validate_date hold_date forbidWechatCancle } } } }`;
    const data = await this.sendGraphql("index", query);
    const raw = data?.data?.userAuth?.reserve?.reserve;
    if (!raw || raw.status === undefined) return null;
    return {
      status: raw.status,
      libName: raw.lib_name,
      seatName: raw.seat_name,
      stime: raw.stime,
      etime: raw.etime,
      tmsg: raw.tmsg,
      sToken: raw.getSToken,
      validateDate: raw.validate_date,
      holdDate: raw.hold_date,
      forbidWechatCancle: raw.forbidWechatCancle === true,
    };
  }

  // 6. Cancel Reservation
  // 官方 schema 的 mutation 名为 reserveCancle（拼写如此）；LDU 命名待实测，失败时可换 reserveCancel 重试
  async cancelReservation(sToken: string, altMutation = false): Promise<GqlResponse> {
    const opName = altMutation ? "reserveCancel" : "reserveCancle";
    const query = `mutation ${opName}($sToken: String!) { userAuth { reserve { ${opName}(sToken: $sToken) } } }`;
    return this.sendGraphql(opName, query, { sToken });
  }

  // 7. Book Seat
  async bookSeat(libId: number, seatKey: string, mode: number = 2, captcha = ""): Promise<GqlResponse> {
    if (mode === 1) {
      // 只有明日预约需要强制排队
      try {
        const wsService = new WebSocketService(this.cookie, this.baseUrl, this.headers["Origin"]);
        bookingLog.info("1. 明日模式：先进入 WebSocket 排队通道...");
        await wsService.passQueue(mode);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("FATAL:")) {
          throw new Error(message.replace("FATAL: ", "排队被拦截: "));
        }
        bookingLog.warn("WebSocket 排队失败，转走 HTTP 通道...", e);
      }
    } else {
      bookingLog.info("1. 即时模式：无需排队，跳过 WebSocket 通道。");
    }

    let preflightQuery = "";
    let preflightVars: Record<string, unknown> = {};
    if (mode === 1) {
      preflightQuery = `query libLayout($libId: Int!) { userAuth { prereserve { libLayout(libId: $libId) { seats_booking seats_total seats_used } } } }`;
      preflightVars = { libId };
    } else {
      preflightQuery = `query libLayout($libId: Int, $libType: Int) { userAuth { reserve { libs(libType: $libType, libId: $libId) { lib_id is_open lib_floor lib_name lib_type lib_layout { seats_total seats_booking seats_used max_x max_y seats { x y key type name seat_status status } } } } } }`;
      preflightVars = { libId };
    }

    try {
      bookingLog.debug(`2. 预检请求 (Mode ${mode})...`);
      await this.sendGraphql("libLayout", preflightQuery, preflightVars);
      
      // 添加一个短暂的停顿
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      bookingLog.warn("预检请求警告（非致命）:", e);
    }
    reserveLog.info("3. 正在执行最终预约请求...");
    let result: GqlResponse;
    if (mode === 2) {
      // 立即抢座 (Today)
      // 官方 schema 的 mutation 名为 reserueSeat，LDU 自建后端仍为 reserveSeat
      const isOfficial = this.baseUrl.includes("wechat.v2.traceint.com");
      const opName = isOfficial ? "reserueSeat" : "reserveSeat";
      const query = `mutation ${opName}($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: String!) { userAuth { reserve { ${opName}(libId: $libId, seatKey: $seatKey, captchaCode: $captchaCode, captcha: $captcha) } } }`;
      const variables = { libId, seatKey, captchaCode: "", captcha };
      result = await this.sendGraphql(opName, query, variables);

      // 官方失败时仅返回 false 不带 errors，漏读会误报成功
      if (result.data?.userAuth?.reserve?.[opName] === false) {
        return { errors: [{ msg: "服务端返回预约失败（座位可能刚被抢占）", code: 0 }] };
      }
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
      reserveLog.info("4. 正在验证预约结果...");
      let validateQuery = "";
      if (mode === 1) {
        validateQuery = `query prereserve { userAuth { prereserve { prereserve { day lib_id seat_key seat_name is_used } } } }`;
        await this.sendGraphql("prereserve", validateQuery);
      } else {
        validateQuery = `query reserve { userAuth { reserve { reserve { status seat_name lib_name } } } }`;
        await this.sendGraphql("reserve", validateQuery);
      }
    } catch (e) {
      reserveLog.warn("验证请求失败（非致命网络问题），但主请求已完成。", e);
    }

    return result;
  }
}
