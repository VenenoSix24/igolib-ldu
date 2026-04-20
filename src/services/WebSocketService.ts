import WebSocket from '@tauri-apps/plugin-websocket';

export class WebSocketService {
  private url: string;
  private headers: Record<string, string>;

  constructor(cookie: string, apiUrl: string) {
    const urlObj = new URL(apiUrl);
    
    // 自动构造 WSS 地址: 把 /index.php/graphql/ 替换为 /ws?ns=prereserve/queue
    this.url = `wss://${urlObj.host}/ws?ns=prereserve/queue`;
    
    const origin = urlObj.protocol + "//" + urlObj.host;

    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090719) XWEB/8391 Flue",
      "Origin": origin,
      "Cookie": cookie
    };
    
    console.log(`[WS] 动态初始化成功: URL=${this.url}, Origin=${origin}`);
  }

  async passQueue(mode: number, onStatus?: (msg: string) => void): Promise<boolean> {
    const log = (msg: string) => {
      console.log(`[WS] ${msg}`);
      onStatus?.(msg);
    };

    log("尝试进入排队通道...");

    try {
      // 使用请求头连接 WebSocket
      const ws = await WebSocket.connect(this.url, {
        headers: this.headers
      });

      log("WebSocket 连接成功");

      // 模式 1: 明日预约 - 在 core.py 中仅连接成功即视为成功
      if (mode === 1) {
        log("明日预约模式：连接成功即视为排队完成");
        await ws.disconnect();
        return true;
      }

      // 模式 2: 当日抢座 - 需要发送握手消息
      return new Promise<boolean>((resolve) => {
        let isResolved = false;

        // 超时机制 (原 Python 优化设定为 3s)
        const timeout = setTimeout(async () => {
          if (!isResolved) {
            log("等待队列消息超时(正常)，将尝试直接并发请求...");
            isResolved = true;
            await ws.disconnect();
            resolve(true); // 超时也被视为“通过”，允许回退到 HTTP 执行
          }
        }, 3000);

        ws.addListener((msg) => {
          if (isResolved) return;

          // 根据实现，msg.data 通常是字符串或简单字节数组
          // plugin-websocket 通常返回 Text 或 Binary 消息
          try {
            // 检查 msg 是否包含数据
            const payload = typeof msg === 'string' ? msg : (msg as any).data;
            if (typeof payload === 'string') {
              const data = JSON.parse(payload);
              const serverMsg = data.msg || payload;
              log(`服务器消息: ${serverMsg}`);

              const lowerMsg = String(serverMsg).toLowerCase();
              if (["ok", "排队成功", "您已经预定了座位"].some(k => lowerMsg.includes(k))) {
                log("排队成功！");
                isResolved = true;
                clearTimeout(timeout);
                ws.disconnect().then(() => resolve(true));
                return;
              }
            }
          } catch (e) {
            log(`消息解析失败: ${e}`);
          }
        });

        // 发送握手
        log("发送握手消息...");
        ws.send(JSON.stringify({ ns: "prereserve/queue", msg: "" }));
      });

    } catch (e) {
      log(`WebSocket 连接失败: ${e}`);
      // 根据 core.py 的逻辑，连接失败可能会警告但仍返回 false (或允许容错？)
      // Python：如果 Cookie 无效则抛出错误，否则返回 false/true
      // 我们稍后将验证 Cookie 逻辑，目前返回 true 以便在 WebSocket 失败时尝试回退到 HTTP？
      // 注意：如果排队失败，在高峰期 HTTP 可能也会失败。但除非极其严格，否则我们将返回 true 以尝试 HTTP。
      return true;
    }
  }
}
