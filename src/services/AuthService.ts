/**
 * 自动身份认证服务 (AuthService)
 * 通过 Tauri Rust 层实现 Cookie 获取，绕过 plugin-http 的 Set-Cookie 限制
 */

import { invoke } from '@tauri-apps/api/core';
import { createLogger } from '@/lib/logger';

const authLog = createLogger("Auth");

export class AuthService {
  /**
   * 构造微信授权引导链接
   * @param appId 微信 AppID
   * @param apiUrl 接口地址
   */
  static buildAuthUrl(appId: string, apiUrl: string): string {
    const urlObj = new URL(apiUrl);
    // 移除 pathname 末尾的斜杠，防止微信移动端校验失败
    const cleanPath = urlObj.pathname.replace(/\/$/, '');
    const redirectUri = encodeURIComponent(`${urlObj.protocol}//${urlObj.host}${cleanPath}`);
    
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo&state=1#wechat_redirect`;
  }

  /**
   * 从微信回调 URL 中提取 Code 并换取 Cookie
   * @param callbackUrl 微信回调的完整 URL
   */
  static async exchangeCodeForCookie(callbackUrl: string): Promise<string> {
    // 规范化并解析 URL
    const cleanUrl = callbackUrl.replace(/\\/g, '');
    let urlObj: URL;
    try {
      urlObj = new URL(cleanUrl);
    } catch {
      throw new Error("请输入有效的回调链接！");
    }
    const code = urlObj.searchParams.get("code");
    const host = urlObj.host;

    if (!code) {
      throw new Error("链接中未找到授权 Code，请确保链接复制完整。");
    }

    authLog.debug(`Domain: ${host}, Code: ${code}`);

    // 构造认证接口 URL
    const targetDomain = `https://${host}`;
    const params = new URLSearchParams({
      "r": `${targetDomain}/web/index.html`,
      "code": code,
      "state": "1"
    });

    const authEndpoint = `${targetDomain}/index.php/urlNew/auth.html?${params.toString()}`;
    authLog.debug(`认证地址: ${authEndpoint}`);

    // 调用 Rust 层执行请求
    const cookieString = await invoke<string>('exchange_cookie', {
      authUrl: authEndpoint
    });

    authLog.info("Cookie 提取成功");


    return cookieString;
  }
}
