import WebSocket from '@tauri-apps/plugin-websocket';

export class WebSocketService {
  private host: string;
  private headers: Record<string, string>;

  constructor(cookie: string, apiUrl: string, customOrigin?: string) {
    const urlObj = new URL(apiUrl);
    this.host = urlObj.host;
    
    // 智能推导优先：外部显式传入 > 官方特殊规则 > 通用回退规则
    let origin = customOrigin || (urlObj.protocol + "//" + urlObj.host);
    if (!customOrigin && urlObj.host.includes("wechat.v2.traceint.com")) {
      origin = "https://web.traceint.com";
    }

    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090719) XWEB/8391 Flue",
      "Origin": origin,
      "Cookie": cookie
    };
    
    console.log(`[WS] 动态初始化成功: Host=${this.host}, Origin=${origin}`);
  }

  async passQueue(mode: number, onStatus?: (msg: string) => void): Promise<boolean> {
    const log = (msg: string) => {
      console.log(`[WS] ${msg}`);
      onStatus?.(msg);
    };

    const ns = "prereserve/queue";
    const wsUrl = `wss://${this.host}/ws?ns=${ns}`;

    log(`尝试进入排队通道 (被请求模式 ${mode}: ${ns})...`);

    try {
      // 使用请求头连接 WebSocket
      const ws = await WebSocket.connect(wsUrl, {
        headers: this.headers
      });

      log("WebSocket 连接成功");

      // 进行完整的 WebSocket 排队轮询验证
      return new Promise<boolean>((resolve, reject) => {
        let isResolved = false;
        let pollTimer: any;

        // 超时15秒，放弃排队
        const timeout = setTimeout(async () => {
          if (!isResolved) {
            log("排队等待超时(15s)，放弃排队尝试...");
            isResolved = true;
            clearInterval(pollTimer);
            await ws.disconnect();
            resolve(false); // 放弃排队，后续可能会兜底HTTP，也可能会失败
          }
        }, 15000);

        ws.addListener((msg) => {
          if (isResolved) return;

          try {
            const payload = typeof msg === 'string' ? msg : (msg as any).data;
            if (typeof payload === 'string') {
              let serverMsg = payload;
              try {
                const data = JSON.parse(payload);
                serverMsg = data.msg || payload;
              } catch (e) {
                // 如果不是 JSON，就直接用字符串
              }
              
              log(`拉回收到: ${serverMsg}`);

              const lowerMsg = String(serverMsg).toLowerCase();

              if (["不在", "未开始", "结束", "已闭馆", "登记了", "已登记"].some(k => lowerMsg.includes(k))) {
                if (mode === 2) {
                  log(`当日推断: 当前时段无需排队 (${serverMsg})，直接放行...`);
                  isResolved = true;
                  clearTimeout(timeout);
                  clearInterval(pollTimer);
                  ws.disconnect().then(() => resolve(true));
                  return;
                } else {
                  // 对于明日预约，这就代表提前返回已知状态
                  log(`排队通道提前返回状态: ${serverMsg}`);
                  isResolved = true;
                  clearTimeout(timeout);
                  clearInterval(pollTimer);
                  ws.disconnect().then(() => reject(new Error(`FATAL: ${serverMsg}`)));
                  return;
                }
              }

              if (["ok", "排队成功", "u6392", "您已经预定了座位", "u6210", "不需要排队"].some(k => lowerMsg.includes(k))) {
                log("排队成功(或无需排队)标志被检测到！");
                isResolved = true;
                clearTimeout(timeout);
                clearInterval(pollTimer);
                setTimeout(() => {
                  ws.disconnect().then(() => resolve(true));
                }, 500);
                return;
              }
            }
          } catch (e) {
            log(`消息解析失败: ${e}`);
          }
        });

        // 使用定时器高频轮询发送
        const payloadStr = JSON.stringify({ ns: ns, msg: "" });
        
        log("开始发送排队轮询...");
        ws.send(payloadStr);

        // 每隔 200 毫秒发送一次
        pollTimer = setInterval(() => {
          if (!isResolved) {
             ws.send(payloadStr);
          }
        }, 200);

      });

    } catch (e) {
      log(`WebSocket 连接失败: ${e}`);
      return true;
    }
  }
}
