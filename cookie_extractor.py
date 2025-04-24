from mitmproxy import http
from mitmproxy import ctx
import re
import os

# --- 配置 ---
# 监听设置新 Cookie 的那个 URL 的响应
# 使用路径的关键部分进行匹配
TARGET_URL_PATTERN = "/index.php/index/boot" # <--- 修改这里！
# 要提取的 Cookie 名称
TARGET_COOKIE_NAME = "Authorization"
# 将提取到的 Cookie 保存到哪个文件
OUTPUT_FILE = "latest_cookie.txt"
# 获取脚本所在的目录来保存文件
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(SCRIPT_DIR, OUTPUT_FILE)

# 用于存储最新获取的 Cookie，防止重复写入相同内容
last_extracted_cookie = None

# mitmproxy 的事件钩子：当收到服务器响应时触发
def response(flow: http.HTTPFlow) -> None:
    global last_extracted_cookie

    # --- 修改 URL 匹配逻辑 ---
    # 检查请求的主机和路径是否匹配
    request_host = flow.request.host
    request_path = flow.request.path

    # 确保主机是目标主机，路径包含目标模式
    if "libseats.ldu.edu.cn" in request_host and TARGET_URL_PATTERN in request_path:
        ctx.log.info(f"检查来自 {flow.request.pretty_url} 的响应...")

        # --- 强制打印所有响应头用于调试 (如果需要可以取消注释) ---
        # ctx.log.info("--- Response Headers ---")
        # for name, value in flow.response.headers.fields:
        #     try:
        #         header_name = name.decode('utf-8', 'replace')
        #         header_value = value.decode('utf-8', 'replace')
        #         ctx.log.info(f"  {header_name}: {header_value}")
        #     except Exception as e:
        #          ctx.log.warn(f"无法解码响应头: {e}")
        # ctx.log.info("-----------------------")
        # --- 结束强制打印 ---

        cookies_set = flow.response.cookies # 解析后的 cookie 字典
        set_cookie_headers = flow.response.headers.get_all("Set-Cookie") # 原始头部列表

        # --- 增加日志 (如果需要可以取消注释) ---
        # if cookies_set: ctx.log.info(f"解析后的 Cookies 字典: {cookies_set}")
        # else: ctx.log.info("flow.response.cookies 为空。")
        # if set_cookie_headers: ctx.log.info(f"原始 Set-Cookie 头部列表: {set_cookie_headers}")
        # else: ctx.log.info("响应头中没有找到 Set-Cookie。")
        # --- 结束增加日志 ---

        # --- 尝试提取目标 Cookie ---
        found_cookie = False
        current_cookie_string = None

        # 优先从解析后的字典提取
        if cookies_set and TARGET_COOKIE_NAME in cookies_set:
            cookie_value = cookies_set[TARGET_COOKIE_NAME][0]
            cookie_attributes = cookies_set[TARGET_COOKIE_NAME][1] # 可以获取属性信息
            current_cookie_string = f"{TARGET_COOKIE_NAME}={cookie_value}"
            ctx.log.info(f"提取到目标 Cookie (来自字典): {current_cookie_string}")
            ctx.log.info(f"  属性: {cookie_attributes}")
            found_cookie = True

        # 如果字典没有，尝试从原始头解析 (以防万一)
        elif set_cookie_headers:
            ctx.log.info(f"未能从 flow.response.cookies 字典中找到 '{TARGET_COOKIE_NAME}'，尝试解析原始 Set-Cookie 头...")
            for header in set_cookie_headers:
                 if header.strip().lower().startswith(f"{TARGET_COOKIE_NAME.lower()}="):
                     match = re.match(rf"{re.escape(TARGET_COOKIE_NAME)}=([^;]+)", header.strip(), re.IGNORECASE)
                     if match:
                         cookie_value = match.group(1)
                         current_cookie_string = f"{TARGET_COOKIE_NAME}={cookie_value}"
                         ctx.log.info(f"提取到目标 Cookie (来自原始头): {current_cookie_string}")
                         found_cookie = True
                         break # 找到第一个就够了

        # --- 处理找到的 Cookie ---
        if found_cookie and current_cookie_string:
            if current_cookie_string != last_extracted_cookie:
                try:
                    with open(OUTPUT_PATH, "w", encoding='utf-8') as f:
                        f.write(current_cookie_string)
                    ctx.log.warn(f"*** 新的 Cookie 已保存到: {OUTPUT_PATH} ***")
                    last_extracted_cookie = current_cookie_string
                except IOError as e:
                    ctx.log.error(f"无法将 Cookie 写入文件 {OUTPUT_PATH}: {e}")
            else:
                ctx.log.info("提取到的 Cookie 与上次相同，未写入文件。")
        elif not found_cookie:
            # 如果执行到这里，说明响应是匹配了 URL，但响应头里确实没有 Set-Cookie: Authorization=...
            ctx.log.warn(f"响应 URL 匹配，但在其 Set-Cookie 中未找到 '{TARGET_COOKIE_NAME}' Cookie。")

    # （可选）处理其他 URL 的逻辑可以在这里添加
    # elif "other.domain.com" in flow.request.host:
    #     pass