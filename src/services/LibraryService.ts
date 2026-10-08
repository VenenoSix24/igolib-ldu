import { fetch } from '@tauri-apps/plugin-http';
import { WebSocketService } from './WebSocketService';
import { createLogger } from '../lib/logger';

const log = createLogger("LibraryService");

/** GraphQL 响应体可能很大（含整层座位列表），出错时优先保留 errors */
function summarizeGraphql(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const body = payload as { errors?: unknown; data?: unknown };
  return body.errors ? { errors: body.errors, data: body.data } : payload;
}

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

interface RawSeat {
  key: string;
  name: string;
  status: boolean;
  type: number;
  seat_status?: number;
}

interface RawLib {
  lib_id: number;
  lib_name: string;
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
      };
      prereserve?: {
        libLayout?: { seats_booking?: number; seats_total?: number; seats_used?: number };
        save?: boolean;
      };
    };
  };
  errors?: GqlError[];
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

    log.info(`初始化: Base=${this.baseUrl}, Origin=${this.headers.Origin}`);
  }

  // 带重试逻辑的通用 GraphQL 发送器
  private async sendGraphql(operationName: string, query: string, variables: Record<string, unknown> = {}): Promise<GqlResponse> {
    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          log.warn(`重试第 ${attempt}/${MAX_RETRIES} 次`, { operationName });
          // 简单指数退避：500ms, 1000ms, ...
          await new Promise(r => setTimeout(r, 500 * (attempt - 1)));
        }

        // Cookie 等凭据由 logger 统一脱敏，这里可以放心带上完整请求头
        log.debug(`→ ${operationName}`, {
          url: this.baseUrl,
          headers: this.headers,
          variables,
        });
        const startedAt = Date.now();

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ operationName, query, variables })
        });

        const elapsed = Date.now() - startedAt;

        if (!response.ok) {
          log.error(`← ${operationName} HTTP ${response.status} (${elapsed}ms)`, response.statusText);
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        log.debug(`← ${operationName} ${response.status} (${elapsed}ms)`, summarizeGraphql(json));
        return json;
      } catch (error) {
        log.error(`请求失败 (第 ${attempt} 次)`, { operationName, error });
        lastError = error;
      }
    }
    throw lastError;
  }

  // 1. Get Room List
  async getRoomList(): Promise<Room[]> {
    const query = `query list { userAuth { reserve { libs(libType: -1) { lib_id lib_name is_open lib_rt { seats_has } } } } }`;
    const data = await this.sendGraphql("list", query);
    const libs = data?.data?.userAuth?.reserve?.libs || [];

    log.info(
      `场馆列表: ${libs.length} 个`,
      libs.map((l) => `${l.lib_name}(${l.lib_id}) 余${l.lib_rt?.seats_has ?? 0}`)
    );

    // 过滤开放的场馆并映射字段
    return libs.map((l) => ({
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

    const filtered = seats.filter((s) => {
      // 过滤掉 name 为空的无效元素
      if (!s.name) return false;
      // 明日预约模式下不过滤占用状态，返回全部座位
      if (includeOccupied) return true;
      const seatStatus = s.seat_status !== undefined ? s.seat_status : 1;
      return seatStatus === 1;
    });

    log.info(
      `场馆 ${libId} 座位解析: 原始 ${seats.length} 个 → 可用 ${filtered.length} 个 (includeOccupied=${includeOccupied})`
    );

    return filtered.map((s) => ({
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
      log.warn("场馆列表为空，Cookie 可能已失效");
      return null;
    } catch (e) {
      log.error("通过场馆列表校验 Cookie 失败", e);
      return null;
    }
  }

  // 4. Find Seat Key by Number
  // includeOccupied 传给 getSeatLayout，确保明日预约时也能解析被占用座位的 Key
  async findSeatKeyByNumber(libId: number, seatNumber: string, includeOccupied = false): Promise<string | null> {
    try {
      const seats = await this.getSeatLayout(libId, includeOccupied);
      const match = seats.find(s => s.name === seatNumber);
      if (!match) {
        log.warn(`座位号 ${seatNumber} 未在返回列表中匹配到 Key`);
      }
      return match ? match.key : null;
    } catch (e) {
      log.error(`无法解析座位 ${seatNumber} 的 Key`, e);
      return null;
    }
  }

  // 5. Book Seat
  async bookSeat(libId: number, seatKey: string, mode: number = 2, captcha = ""): Promise<GqlResponse> {
    if (mode === 1) {
      // 只有明日预约需要强制排队
      try {
        const wsService = new WebSocketService(this.cookie, this.baseUrl, this.headers["Origin"]);
        log.info("1. 明日模式: 进入 WebSocket 排队通道...");
        await wsService.passQueue(mode);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("FATAL:")) {
          throw new Error(message.replace("FATAL: ", "排队被拦截: "));
        }
        log.warn("WebSocket 排队失败/被绕过，转走 HTTP", e);
      }
    } else {
      log.info("1. 今日模式: 无需排队，跳过 WebSocket");
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
      log.info(`2. 预请求 (mode=${mode})...`);
      await this.sendGraphql("libLayout", preflightQuery, preflightVars);
      
      // 添加一个短暂的停顿
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      log.warn("预请求失败（非致命）", e);
    }
    log.info(`3. 执行最终${mode === 2 ? "抢座" : "预约"}请求...`);
    let result: GqlResponse;
    if (mode === 2) {
      // 立即抢座 (Today)
      // 官方 schema 的 mutation 名为 reserueSeat，LDU 自建后端仍为 reserveSeat
      const isOfficial = this.baseUrl.includes("wechat.v2.traceint.com");
      const opName = isOfficial ? "reserueSeat" : "reserveSeat";
      const query = `mutation ${opName}($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: String!) { userAuth { reserve { ${opName}(libId: $libId, seatKey: $seatKey, captchaCode: $captchaCode, captcha: $captcha) } } }`;
      const variables = { libId, seatKey, captchaCode: "", captcha };
      log.info(`使用接口: ${opName} (official=${isOfficial})`);
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
      log.info("4. 校验预约结果...");
      let validateQuery = "";
      if (mode === 1) {
        validateQuery = `query prereserve { userAuth { prereserve { prereserve { day lib_id seat_key seat_name is_used } } } }`;
        await this.sendGraphql("prereserve", validateQuery);
      } else {
        validateQuery = `query reserve { userAuth { reserve { reserve { status seat_name lib_name } } } }`;
        await this.sendGraphql("reserve", validateQuery);
      }
    } catch (e) {
      log.warn("校验请求失败（非致命，主请求已完成）", e);
    }

    return result;
  }
}
