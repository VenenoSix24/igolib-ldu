# -*- coding: utf-8 -*-
import asyncio
import datetime
import glob
import json
import os
import re
import stat
import sys
import time
import atexit
import traceback
import subprocess
from typing import Any, Callable, Dict, List, Optional, Tuple
import requests
import websocket  # 需要安装 websocket-client

# --- 全局变量，用于跟踪 mitmproxy 进程 ---
mitmproxy_process = None

# --- Web Dependencies (Import conditionally) ---
try:
    from fastapi import (
        BackgroundTasks,
        FastAPI,
        HTTPException,
        Request,
        WebSocket,
        WebSocketDisconnect,
    )
    from fastapi.responses import JSONResponse
    from fastapi.templating import Jinja2Templates
    from pydantic import BaseModel, Field, validator
    import uvicorn

    WEB_DEPENDENCIES_MET = True
    # Initialize app only if dependencies are met
    app = FastAPI(title="我去抢个座", description="用于预约或抢座图书馆座位")

except ImportError:
    WEB_DEPENDENCIES_MET = False
    # Dummy definitions for type hinting if needed elsewhere, but avoid re-assigning imported names
    FastAPI = None
    Request = Any
    HTTPException = type("HTTPException", (Exception,), {}) # Basic Exception dummy
    WebSocket = Any
    WebSocketDisconnect = Any
    BackgroundTasks = Any # Keep Any for type hints, don't assign None
    JSONResponse = None
    Jinja2Templates = Any # type: ignore
    BaseModel = object # Basic object dummy for Pydantic
    validator = lambda *args, **kwargs: lambda f: f # Dummy decorator
    Field = lambda default=None, **kwargs: default
    uvicorn = None
    # asyncio is always available

    print("\n❌ 错误：运行 Web 界面需要 FastAPI 相关依赖库，但未能成功导入。")
    print("请确保已安装: pip install fastapi uvicorn jinja2 pydantic websockets websocket-client requests")
    print("Web 服务器功能将不可用。\n")
    app = None # Explicitly set app to None

# --- Configuration ---
URL = '这里填写URL'
WEBSOCKET_URL = 'wss://XXXX/ws?ns=prereserve/queue'
MAX_REQUEST_ATTEMPTS = 3 # Example: Set maximum request attempts
SLEEP_INTERVAL_ON_FAIL = 0.5
COOKIE_ERROR_PATTERN = r'Connection to remote host was lost|invalid session|请先登录|登陆|验证失败'
TOMORROW_RESERVE_WINDOW_START = datetime.time(19, 48, 0) # Example window start
TOMORROW_RESERVE_WINDOW_END = datetime.time(23, 59, 59) # Example window end
DEFAULT_RESERVE_TIME_STR = "21:48:00"
COOKIE_FILENAME = "latest_cookie.txt"
FILE_CHECK_INTERVAL = 2 # Seconds
MAX_WAIT_TIME = 120 # Seconds

# --- 配置 mitmproxy 脚本路径 ---
MITMPROXY_SCRIPT_NAME = "cookie_extractor.py"
# MITMPROXY_SCRIPT_PATH = os.path.join(SCRIPT_DIR, MITMPROXY_SCRIPT_NAME)
# --- 选择 mitmproxy 启动命令 (mitmweb 或 mitmproxy) ---
# 使用 mitmweb 通常对用户更友好，因为它提供 Web UI (http://127.0.0.1:8081)
MITMPROXY_COMMAND = "mitmweb"
# 如果只想用命令行界面，或者 mitmweb 有问题，可以用下面这个
# MITMPROXY_COMMAND = "mitmproxy"

# --- Path Configuration ---
try:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    SCRIPT_DIR = os.getcwd()
DATA_DIR = os.path.join(SCRIPT_DIR, 'data_process')
ROOM_MAPPINGS_FILE = os.path.join(DATA_DIR, 'room', 'output', 'room_mappings.json')
SEAT_MAPPINGS_DIR = os.path.join(DATA_DIR, 'seat', 'output')
TEMPLATES_DIR = os.path.join(SCRIPT_DIR, 'templates')
COOKIE_FILE_PATH = os.path.join(SCRIPT_DIR, COOKIE_FILENAME)

# --- Global Variables ---
ROOM_ID_TO_NAME: Dict[str, str] = {}
ROOM_NAME_TO_ID: Dict[str, str] = {}
SEAT_MAPPINGS: Dict[str, Dict[str, str]] = {} # { room_name: { seat_number: seat_key } }
SEAT_TAKEN_ERROR_CODE = "SEAT_TAKEN"

# --- Data Loading Function ---
def load_mappings() -> bool:
    """Loads room and seat mappings from JSON files."""
    global ROOM_ID_TO_NAME, ROOM_NAME_TO_ID, SEAT_MAPPINGS
    print("正在加载阅览室和座位映射数据...")
    ROOM_ID_TO_NAME.clear(); ROOM_NAME_TO_ID.clear(); SEAT_MAPPINGS.clear()
    try:
        if not os.path.exists(ROOM_MAPPINGS_FILE):
            print(f"错误: 阅览室映射文件未找到: {ROOM_MAPPINGS_FILE}")
            return False
        with open(ROOM_MAPPINGS_FILE, 'r', encoding='utf-8') as f:
            ROOM_ID_TO_NAME = json.load(f)
        ROOM_NAME_TO_ID = {v: k for k, v in ROOM_ID_TO_NAME.items()}
        print(f"成功加载 {len(ROOM_ID_TO_NAME)} 个阅览室映射。")

        seat_files = glob.glob(os.path.join(SEAT_MAPPINGS_DIR, '*.json'))
        if not seat_files:
             print(f"警告: 在 {SEAT_MAPPINGS_DIR} 未找到座位映射文件 (*.json)。")
        else:
            loaded_seat_maps = 0
            for seat_file in seat_files:
                try:
                    room_name_from_file = os.path.splitext(os.path.basename(seat_file))[0]
                    if room_name_from_file in ROOM_NAME_TO_ID: # Check against loaded room names
                        with open(seat_file, 'r', encoding='utf-8') as f:
                            seat_map = json.load(f)
                            if isinstance(seat_map, dict):
                                SEAT_MAPPINGS[room_name_from_file] = seat_map
                                loaded_seat_maps += 1
                            else:
                                print(f"警告: 座位文件 '{os.path.basename(seat_file)}' 内容格式不正确，已跳过。")
                    else:
                        print(f"警告: 座位文件 '{os.path.basename(seat_file)}' 对应的阅览室 '{room_name_from_file}' 未找到，已跳过。")
                except Exception as e:
                    print(f"加载座位文件 {seat_file} 时发生错误: {e}")
            if loaded_seat_maps > 0:
                print(f"成功加载 {loaded_seat_maps} 个阅览室的座位映射。")
            elif seat_files:
                print(f"警告: 找到了座位文件，但未能成功加载任何有效的座位映射。")

        if not ROOM_ID_TO_NAME:
            print("错误: 未能加载任何阅览室数据。")
            return False
        return True

    except Exception as e:
        print(f"加载映射数据时发生错误: {type(e).__name__} - {e}")
        return False

# --- Default Payloads ---
# Using multi-line strings for better readability
queue_header_base: Dict[str, str] = {
    'Host': 'XXXX',
    'Connection': 'Upgrade', 
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/13603 Flue',
    'Upgrade': 'websocket', 
    'Origin': 'https://XXXX',
    'Sec-WebSocket-Version': '13', 
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9', 
    'Cookie': ''
}
pre_header_base: Dict[str, str] = {
    'Host': 'XXXX', 
    'Connection': 'keep-alive',
    'Content-Length': '353',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/13603 Flue',
    'Content-Type': 'application/json', 
    'Accept': '*/*', 
    'Origin': 'https://XXXX',
    'Sec-Fetch-Site': 'same-origin', 
    'Sec-Fetch-Mode': 'cors', 
    'Sec-Fetch-Dest': 'empty',
    'Referer': 'https://XXXX/web/index.html',
    'Accept-Encoding': 'gzip, deflate, br', 
    'Accept-Language': 'zh-CN,zh;q=0.9', 
    'Cookie': ''
}
_tomorrow_query = """
mutation save($key: String!, $libid: Int!, $captchaCode: String, $captcha: String) {
  userAuth {
    prereserve {
      save(key: $key, libId: $libid, captcha: $captcha, captchaCode: $captchaCode)
    }
  }
}
"""
data_template_tomorrow: Dict[str, Any] = {
    "operationName": "save", "variables": {"key": "", "libid": 0, "captchaCode": "", "captcha": ""},
    "query": _tomorrow_query.strip()
}
_today_query = """
mutation reserveSeat($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: String!) {
  userAuth {
    reserve {
      reserveSeat(libId: $libId, seatKey: $seatKey, captchaCode: $captchaCode, captcha: $captcha)
    }
  }
}
"""
data_template_today: Dict[str, Any] = {
    "operationName": "reserveSeat", "variables": {"seatKey": "", "libId": 0, "captchaCode": "", "captcha": ""},
    "query": _today_query.strip()
}
_validate_query = """
query prereserve {
  userAuth {
    prereserve {
      prereserve {
        day
        lib_id
        seat_key
        seat_name
        is_used
        user_mobile
        id
        lib_name
      }
    }
  }
}
"""
data_validate: Dict[str, Any] = {"operationName": "prereserve", "query": _validate_query.strip()}
_layout_query = """
query libLayout($libId: Int!) {
  userAuth {
    prereserve {
      libLayout(libId: $libId) {
        max_x
        max_y
        seats_booking
        seats_total
        seats_used
        seats {
          key
          name
          seat_status
          status
          type
          x
          y
        }
      }
    }
  }
}
"""
data_lib_chosen_template: Dict[str, Any] = {
    "operationName": "libLayout", "variables": {"libId": 0},
    "query": _layout_query.strip()
}

# --- 函数：启动 mitmproxy ---
def start_mitmproxy():
    """启动 mitmproxy 脚本作为后台进程"""
    global mitmproxy_process
    try:
        # 尝试获取当前文件所在目录
        CURRENT_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    except NameError:
        # 如果在交互模式等环境中运行，回退到当前工作目录
        CURRENT_SCRIPT_DIR = os.getcwd()

    MITMPROXY_SCRIPT_PATH = os.path.join(CURRENT_SCRIPT_DIR, MITMPROXY_SCRIPT_NAME)

    if mitmproxy_process and mitmproxy_process.poll() is None:
        print("Mitmproxy 进程似乎已在运行。")
        return True

    if not os.path.exists(MITMPROXY_SCRIPT_PATH):
        print(f"错误：mitmproxy 脚本未找到: {MITMPROXY_SCRIPT_PATH}")
        return False

    command = [MITMPROXY_COMMAND, "-s", MITMPROXY_SCRIPT_PATH, "--set", "web_port=8081"]

    try:
        print(f"正在启动 mitmproxy ({MITMPROXY_COMMAND}) 后台进程...")
        mitmproxy_process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        print(f"Mitmproxy 进程已启动 (PID: {mitmproxy_process.pid})。")
        if MITMPROXY_COMMAND == "mitmweb":
             print("提示：可以在浏览器打开 http://127.0.0.1:8081 查看 mitmweb 界面。")
        time.sleep(2)
        if mitmproxy_process.poll() is not None:
             print("错误：Mitmproxy 进程启动后立刻退出了。")
             stderr_output = mitmproxy_process.stderr.read().decode(errors='ignore') if mitmproxy_process.stderr else "N/A"
             print(f"Mitmproxy 错误输出: {stderr_output}")
             mitmproxy_process = None
             return False
        return True
    except FileNotFoundError:
        print(f"错误：无法找到 '{MITMPROXY_COMMAND}' 命令。")
        mitmproxy_process = None
        return False
    except Exception as e:
        print(f"启动 mitmproxy 时发生错误: {e}")
        mitmproxy_process = None
        return False

# --- 函数：停止 mitmproxy ---
def stop_mitmproxy():
    """停止由本程序启动的 mitmproxy 进程"""
    global mitmproxy_process
    if mitmproxy_process and mitmproxy_process.poll() is None: # 检查进程是否存在且在运行
        print(f"正在尝试终止 mitmproxy 进程 (PID: {mitmproxy_process.pid})...")
        try:
            mitmproxy_process.terminate() # 尝试友好终止
            mitmproxy_process.wait(timeout=5) # 等待最多5秒
            print("Mitmproxy 进程已终止。")
        except subprocess.TimeoutExpired:
            print("警告：Mitmproxy 进程未能在5秒内终止，尝试强制结束...")
            try:
                mitmproxy_process.kill()
                mitmproxy_process.wait(timeout=2)
                print("Mitmproxy 进程已被强制结束。")
            except Exception as kill_err:
                print(f"强制结束 mitmproxy 进程时出错: {kill_err}")
        except Exception as e:
            print(f"终止 mitmproxy 进程时发生错误: {e}")
        finally:
             mitmproxy_process = None # 清理引用
    # else:
    #     print("没有需要停止的 mitmproxy 进程。")


# --- 注册退出处理函数 ---
# 确保在 beta.py 退出时，我们启动的 mitmproxy 也能退出
atexit.register(stop_mitmproxy)

# --- Helper Functions ---
def extract_error_msg(response_text: str) -> str:
    """Extracts the error message from the JSON response."""
    try:
        data = json.loads(response_text)
        errors = data.get("errors")
        if errors and isinstance(errors, list) and errors:
            error_info = errors[0]
            msg = error_info.get("msg", str(error_info))
            # Attempt to decode potential unicode escapes
            return msg.encode('latin-1', 'backslashreplace').decode('unicode-escape', 'replace') if isinstance(msg, str) else str(msg)
        msg = data.get("msg")
        if msg:
            return str(msg)
        # Fallback for unexpected structure
        return response_text[:200] + ("..." if len(response_text) > 200 else "")
    except json.JSONDecodeError:
        # Handle non-JSON response
        try:
            return response_text.encode('latin-1', 'backslashreplace').decode('unicode-escape', 'replace')[:200] + ("..." if len(response_text) > 200 else "")
        except Exception:
             return response_text[:200] + ("..." if len(response_text) > 200 else "") # Raw fallback
    except Exception as e:
        return f"解析错误信息时发生内部错误: {type(e).__name__}"


def pass_queue(ws_headers: Dict[str, str], status_callback: Optional[Callable[[str], None]] = None) -> bool:
    """Simulates WebSocket queueing, sends status updates via callback."""

    def send_status_pq(msg: str):
        """Internal helper to print and send status."""
        print(msg)
        if status_callback:
            cleaned_msg = msg.strip().replace('\r', '')
            if cleaned_msg:
                try:
                    status_callback(cleaned_msg)
                except Exception as pq_cb_err:
                    print(f"[Callback Error in pass_queue] {pq_cb_err}")

    send_status_pq("\n================================")
    send_status_pq("尝试进入排队通道...")
    ws = None
    is_success = False
    try:
        ws = websocket.create_connection(WEBSOCKET_URL, header=ws_headers, suppress_origin=True, timeout=10) # Added connection timeout
        if ws.connected:
            send_status_pq('WebSocket 连接成功，开始排队...')
            ws.send('{"ns":"prereserve/queue","msg":""}')
            timeout_seconds = 15 # Increased receive timeout
            start_time = time.time()
            while time.time() - start_time < timeout_seconds:
                try:
                    # Calculate remaining time for recv timeout
                    receive_timeout = max(0.1, timeout_seconds - (time.time() - start_time))
                    ws.settimeout(receive_timeout)
                    raw_response = ws.recv()
                    decoded_response = raw_response # Default
                    try:
                        msg_data = json.loads(raw_response)
                        decoded_response = msg_data.get('msg', raw_response)
                        send_status_pq(f"服务器消息: {decoded_response}")
                    except json.JSONDecodeError:
                        try: decoded_response = raw_response.encode('latin-1', 'backslashreplace').decode('unicode-escape', 'replace')
                        except: decoded_response = str(raw_response) # Fallback
                        send_status_pq(f"排队中，服务器响应: {decoded_response}")

                    # Check keywords case-insensitively for robustness
                    decoded_lower = str(decoded_response).lower()
                    success_keywords = ["ok", "排队成功", "您已经预定了座位", "您已经预约了座位", "当前已经在队列中"]
                    if any(keyword in decoded_lower for keyword in success_keywords):
                         send_status_pq("排队成功或已在队列/已完成预约。")
                         is_success = True
                         break
                    failure_keywords = ["验证失败", "invalid session"]
                    if any(keyword in decoded_lower for keyword in failure_keywords):
                         send_status_pq("排队时检测到验证失败，可能Cookie已失效。")
                         raise ConnectionError("Cookie失效(WebSocket)，请更新Cookie.")
                    time.sleep(0.1) # Small delay between checks

                except websocket.WebSocketTimeoutException:
                    send_status_pq(f"排队响应超时（等待 {receive_timeout:.1f} 秒后）。")
                    break
                except websocket.WebSocketConnectionClosedException as e:
                    code = getattr(e, 'code', 'N/A'); reason = getattr(e, 'reason', 'N/A')
                    send_status_pq(f"WebSocket 连接在排队过程中关闭: Code={code}, Reason={reason} (Exception: {e})")
                    if code == 1006 or (isinstance(reason, str) and "Connection to remote host was lost" in reason):
                         send_status_pq("连接异常关闭，可能与Cookie有关。")
                    break
                except Exception as e_inner:
                    send_status_pq(f"WebSocket 通信错误: {type(e_inner).__name__} - {e_inner}")
                    send_status_pq(traceback.format_exc())
                    break # Exit inner loop on other errors

            if not is_success and time.time() - start_time >= timeout_seconds:
                 send_status_pq("排队未在规定时间内确认成功。")
        else:
            send_status_pq("WebSocket 连接失败。")

    except ConnectionRefusedError: send_status_pq("WebSocket 连接被拒绝。")
    except websocket.WebSocketTimeoutException: send_status_pq("WebSocket 建立连接超时。") # Catch connection timeout
    except websocket.WebSocketException as e:
        send_status_pq(f"WebSocket 建立连接时出错: {e}")
        if re.search(COOKIE_ERROR_PATTERN, str(e), re.IGNORECASE):
            raise ConnectionError("Cookie失效(WebSocket Init)，请更新Cookie.")
    except ConnectionError as e: # Propagate specific cookie errors
        raise e
    except Exception as e_outer:
        send_status_pq(f"排队过程中发生未知错误: {type(e_outer).__name__} - {e_outer}")
        send_status_pq(traceback.format_exc())
    finally:
        if ws and ws.connected:
            try: ws.close(); send_status_pq("WebSocket 连接已关闭。")
            except Exception as e_close: send_status_pq(f"关闭WebSocket时出错: {e_close}")
        send_status_pq("排队尝试结束。"); send_status_pq("================================")
    return is_success


def validate_time_format(time_str: str) -> bool:
    """Validates HH:MM:SS time format."""
    return bool(re.match(r'^\d{2}:\d{2}:\d{2}$', time_str))


def calculate_execution_dt(time_str: str, check_window: bool = False) -> Optional[datetime.datetime]:
    """Calculates execution datetime, optionally checks window and past time."""
    now_dt = datetime.datetime.now(); today_date = now_dt.date()
    try: exec_time = datetime.datetime.strptime(time_str, "%H:%M:%S").time()
    except ValueError: print(f"错误: 时间格式无效 '{time_str}'"); return None
    exec_dt = datetime.datetime.combine(today_date, exec_time)

    if check_window:
        window_start_dt = datetime.datetime.combine(today_date, TOMORROW_RESERVE_WINDOW_START)
        window_end_dt = datetime.datetime.combine(today_date, TOMORROW_RESERVE_WINDOW_END)
        if not (window_start_dt <= exec_dt <= window_end_dt):
            start_str = TOMORROW_RESERVE_WINDOW_START.strftime('%H:%M:%S')
            end_str = TOMORROW_RESERVE_WINDOW_END.strftime('%H:%M:%S')
            print(f"错误: 预约时间 {time_str} 不在窗口内 ({start_str} - {end_str})。")
            return None
    # Check if scheduled time is in the past (allow 5 sec buffer)
    if exec_dt < now_dt - datetime.timedelta(seconds=5):
         print(f"错误: 指定时间 {time_str} ({exec_dt.strftime('%Y-%m-%d %H:%M:%S')}) 已过。")
         return None

    print(f"计划执行时间已设置为: {exec_dt.strftime('%Y-%m-%d %H:%M:%S')}")
    return exec_dt


# --- Main Operation Function (FIXED) ---
def perform_seat_operation(
    mode: int,
    cookie: str,
    lib_id: int,
    seat_key: str,
    start_action_dt: Optional[datetime.datetime],
    status_callback: Optional[Callable[[str], None]] = None
) -> str:
    """
    执行座位预约/抢座操作，包含详细状态更新和错误处理。
    返回 "成功"、SEAT_TAKEN_ERROR_CODE 或错误消息字符串。
    """
    def send_status(msg: str):
        """打印到控制台并通过回调发送状态 (如果可用)。"""
        print(msg)
        if status_callback:
            cleaned_msg = msg.strip().replace('\r', '')
            if cleaned_msg:
                try:
                    status_callback(cleaned_msg)
                except Exception as cb_err:
                    print(f"[Callback Error] {cb_err}")

    # --- 1. 尽早验证模式参数 ---
    if mode not in [1, 2]:
        err_msg = f"内部错误：接收到无效的操作模式值 ({mode})"
        send_status(f"❌ {err_msg}")
        return err_msg
    mode_str = '预约' if mode == 1 else '抢座'

    # --- 获取阅览室和座位信息 (用于日志) ---
    room_name = ROOM_ID_TO_NAME.get(str(lib_id), f"ID {lib_id}")
    seat_number_str = "未知"
    if room_name in SEAT_MAPPINGS:
        reverse_seat_map = {v: k for k, v in SEAT_MAPPINGS[room_name].items()}
        seat_number_str = reverse_seat_map.get(seat_key, "未知Key")

    send_status(f"\n--- 开始执行 {mode_str} 操作 ---")
    send_status(f"模式: {'明日预约' if mode == 1 else '立即抢座'} | 阅览室: {room_name} ({lib_id}) | 座位: {seat_number_str} (Key: {seat_key})")

    # --- 确定执行时间 ---
    if start_action_dt:
        exec_time_str = start_action_dt.strftime('%Y-%m-%d %H:%M:%S')
        send_status(f"计划执行时间: {exec_time_str}")
    else:
        send_status("计划执行时间: 立即执行")
        start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1) # 确保立即执行
    send_status("-" * 30)

    # --- 准备请求头和 Payloads ---
    current_pre_header = pre_header_base.copy(); current_pre_header['Cookie'] = cookie
    current_queue_header = queue_header_base.copy(); current_queue_header['Cookie'] = cookie
    try:
        data_lib_chosen = json.loads(json.dumps(data_lib_chosen_template))
        data_lib_chosen['variables']['libId'] = lib_id
        if mode == 1:
            main_payload = json.loads(json.dumps(data_template_tomorrow))
            main_payload['variables']['key'] = seat_key
            main_payload['variables']['libid'] = lib_id
        elif mode == 2:
            main_payload = json.loads(json.dumps(data_template_today))
            main_payload['variables']['seatKey'] = seat_key
            main_payload['variables']['libId'] = lib_id
        data_validate_payload = json.loads(json.dumps(data_validate))
    except Exception as e:
        err_msg = f"内部错误：准备请求负载时发生错误: {e}"
        send_status(f"❌ {err_msg}")
        return err_msg

    # --- 处理等待时间 ---
    now_dt = datetime.datetime.now()
    if start_action_dt and start_action_dt > now_dt:
        wait_seconds = (start_action_dt - now_dt).total_seconds()
        if wait_seconds > 0:
            send_status(f"等待计划执行时间: {start_action_dt.strftime('%Y-%m-%d %H:%M:%S')}...")
            last_ws_update_time = time.time()
            while True:
                now_ts = time.time()
                remaining_seconds = start_action_dt.timestamp() - now_ts
                if remaining_seconds <= 0.01:
                    send_status("\n时间到，开始执行！")
                    break
                # 每 0.5 秒左右更新一次控制台和 WebSocket
                if int(remaining_seconds * 2) != int((remaining_seconds - 0.1) * 2):
                    countdown_msg = f"距离计划执行时间还有 {remaining_seconds:.1f} 秒..."
                    print(f"\r{countdown_msg}", end="", flush=True)
                    if status_callback and (now_ts - last_ws_update_time >= 0.5):
                        status_callback(countdown_msg)
                        last_ws_update_time = now_ts
                # 自适应休眠
                sleep_duration = max(0.005, min(0.1, remaining_seconds / 10))
                time.sleep(sleep_duration)
            print() # 倒计时结束后换行

    # --- 请求循环 ---
    last_error_msg = f"达到最大尝试次数({MAX_REQUEST_ATTEMPTS})仍未成功。" # 默认最终错误消息
    session = requests.Session() # 使用 Session 保持连接和 Cookie

    for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
        send_status(f"\n--- 第 {attempt}/{MAX_REQUEST_ATTEMPTS} 次尝试 ---")
        res: Optional[requests.Response] = None # 类型提示
        text_res_validate = ""
        current_attempt_error: Optional[str] = None # 本次尝试的具体错误

        try:
            # --- 步骤 1: 排队 (WebSocket) ---
            send_status("步骤 1/5: 执行排队...");
            queue_success = pass_queue(current_queue_header, status_callback=status_callback)
            if not queue_success: send_status("警告: 排队未确认成功，继续尝试...")
            else: send_status("排队步骤完成。")

            # --- 步骤 2: 选择阅览室 (HTTP POST) ---
            send_status(f"步骤 2/5: 选择阅览室 ({room_name})...");
            response_lib_chosen = session.post(URL, headers=current_pre_header, json=data_lib_chosen, timeout=10)
            send_status(f"  - 选择阅览室响应: {response_lib_chosen.status_code}")
            response_lib_chosen.raise_for_status() # 检查 HTTP 错误

            # --- 步骤 3: 主操作 (HTTP POST) ---
            send_status(f"步骤 3/5: 执行 {mode_str} (座位 {seat_number_str})...");
            time.sleep(0.1) # 短暂延迟
            res = session.post(URL, headers=current_pre_header, json=main_payload, timeout=15)
            send_status(f"  - 主操作响应: {res.status_code}")
            main_action_text = res.text # 保存响应文本

            # --- 步骤 4: 验证请求 (HTTP POST) ---
            send_status("步骤 4/5: 发送验证请求...");
            response_validate = session.post(URL, headers=current_pre_header, json=data_validate_payload, timeout=10)
            send_status(f"  - 验证响应: {response_validate.status_code}")
            text_res_validate = response_validate.text
            response_validate.raise_for_status() # 检查 HTTP 错误

            # --- 步骤 5: 检查主操作结果 ---
            send_status("步骤 5/5: 检查主操作结果...");
            main_action_failed = False
            error_msg_main = ""
            try:
                res.raise_for_status() # 检查主操作的 HTTP 错误
                main_action_failed = '"errors":' in main_action_text # 检查响应体是否包含 "errors"
            except requests.exceptions.HTTPError as http_err:
                # 处理主操作的 HTTP 错误
                send_status(f"  - 主操作 HTTP 错误: {http_err}")
                main_action_failed = True
                error_msg_main = extract_error_msg(main_action_text)
                send_status(f"  - HTTP 错误信息: {error_msg_main}")
                current_attempt_error = f"主操作HTTP错误: {http_err}" # 记录本次错误
                # 检查是否是 Cookie 错误
                combined_texts = main_action_text + text_res_validate + error_msg_main + str(http_err)
                if re.search(COOKIE_ERROR_PATTERN, combined_texts, re.IGNORECASE):
                    last_error_msg = "Cookie失效或验证失败(HTTP错误)，请更新。"
                    send_status(f"❌ 失败: {last_error_msg}")
                    return last_error_msg # 立刻返回

            # --- 分析主操作响应内容 ---
            if not main_action_failed: # HTTP 成功且响应体不含 "errors"
                try:
                    main_action_data = json.loads(main_action_text)
                    success_indicator = False
                    # 检查特定的成功标志
                    if mode == 1 and main_action_data.get("data", {}).get("userAuth", {}).get("prereserve", {}).get("save") is not None: success_indicator = True
                    elif mode == 2 and main_action_data.get("data", {}).get("userAuth", {}).get("reserve", {}).get("reserveSeat") is not None: success_indicator = True

                    if success_indicator:
                        success_msg = f"✅ {mode_str}成功 (主操作响应 {res.status_code}, 内容符合预期)"
                        send_status("******************************")
                        send_status(success_msg)
                        send_status("******************************\n")
                        return "成功" # 操作成功，直接返回
                    else:
                        # HTTP 成功，无 "errors"，但内容不符合成功格式
                        current_attempt_error = f"主操作响应码 {res.status_code} 但内容格式非预期成功。响应: {main_action_text[:150]}..."
                        send_status(f"  - 警告: {current_attempt_error}")

                except json.JSONDecodeError:
                    # HTTP 成功但响应不是 JSON
                    current_attempt_error = f"主操作响应码 {res.status_code} 但响应非JSON格式: {main_action_text[:150]}..."
                    send_status(f"❌ 失败: {current_attempt_error}")

            else: # 主操作失败 (HTTP 错误 或 响应体含 "errors")
                if not error_msg_main: # 如果之前 HTTP 错误处理未提取，则现在提取
                    error_msg_main = extract_error_msg(main_action_text)
                send_status(f"  - 主操作错误信息: {error_msg_main}")

                # --- 特定的业务逻辑错误处理 ---
                if "access denied" in error_msg_main.lower():
                    send_status("❌ 检测到 'Access Denied!'")
                    return "Cookie无效或已过期，请更新。" # 返回用户友好的 Cookie 错误

                if "不在预约时间内" in error_msg_main:
                    return f"❌ {mode_str}失败: 不在预约/抢座时间段内。"

                seat_taken_errors = ["该座位已经被人预定了", "您选择的座位已被预约", "已被占座"]
                if any(err in error_msg_main for err in seat_taken_errors):
                    send_status(f"❌ 座位 ({seat_number_str}) 已被占用。")
                    return SEAT_TAKEN_ERROR_CODE # 返回特定错误码

                success_keywords = ["您已经预约了座位", "您已经预定了座位", "操作成功", "当前已有有效预约"]
                if any(keyword in error_msg_main for keyword in success_keywords):
                    send_status("******************************")
                    send_status(f"✅ {mode_str}成功 (检测到确认性消息: {error_msg_main})")
                    send_status("******************************\n")
                    return f"成功 ({error_msg_main})" # 返回成功及消息

                # --- 一般主操作错误 ---
                current_attempt_error = f"主操作错误: {error_msg_main}"
                # 再次检查 Cookie 错误模式
                combined_texts = main_action_text + text_res_validate
                if re.search(COOKIE_ERROR_PATTERN, combined_texts, re.IGNORECASE):
                     last_error_msg = "Cookie失效或验证失败，请更新。"
                     send_status(f"❌ 失败: {last_error_msg}")
                     return last_error_msg

                # 记录一般的主操作错误，准备重试
                send_status(f"❌ 第 {attempt} 次尝试失败: {current_attempt_error}")


        # --- 处理请求过程中的其他异常 ---
        except requests.exceptions.Timeout as e:
            current_attempt_error = f"请求超时 ({e})"
            send_status(f"❌ 第 {attempt} 次尝试失败: {current_attempt_error}")
        except requests.exceptions.RequestException as e:
            current_attempt_error = f"网络请求错误: {e}"
            send_status(f"❌ 第 {attempt} 次尝试失败: {current_attempt_error}")
            # 检查网络错误是否由 Cookie 问题引起
            if re.search(COOKIE_ERROR_PATTERN, str(e), re.IGNORECASE):
                last_error_msg = "Cookie失效(请求异常)，请更新。"
                send_status(f"检测到可能的Cookie失效。失败: {last_error_msg}")
                return last_error_msg # 立即返回
        except ConnectionError as e:
            # 通常是来自 pass_queue 的 WebSocket Cookie 错误
            last_error_msg = str(e)
            send_status(f"❌ 第 {attempt} 次尝试失败 (来自排队): {last_error_msg}")
            return last_error_msg # 立即返回
        except Exception as e:
            # 捕获所有其他未知异常
            error_details = traceback.format_exc()
            current_attempt_error = f"发生未知错误: {type(e).__name__} - {e}"
            send_status(f"❌ 第 {attempt} 次尝试中失败: {current_attempt_error}")
            send_status(f"详细错误追踪: \n{error_details}")
            # 检查未知异常是否是 Cookie 相关
            if re.search(COOKIE_ERROR_PATTERN, str(e), re.IGNORECASE):
                 last_error_msg = "Cookie失效(未知异常)，请更新。"
                 send_status(f"检测到可能的Cookie失效。失败: {last_error_msg}")
                 return last_error_msg # 是 Cookie 错误，直接返回
            else:
                 # --- !!! FIX: 非 Cookie 相关的未知异常，终止操作 !!! ---
                 last_error_msg = current_attempt_error # 更新最终错误信息
                 send_status("发生不可恢复的未知错误，操作终止。")
                 return last_error_msg # 返回错误信息，不再重试

        # --- 更新最后错误信息并判断是否重试 ---
        if current_attempt_error:
            last_error_msg = current_attempt_error # 保存本次尝试的具体错误

        # 只有在没有成功返回，且尝试次数未满时才重试
        if attempt < MAX_REQUEST_ATTEMPTS:
            send_status(f"等待 {SLEEP_INTERVAL_ON_FAIL} 秒后重试...")
            time.sleep(SLEEP_INTERVAL_ON_FAIL)
        # else: 最后一次尝试失败，循环结束

    # --- 循环结束 ---
    # 如果循环正常结束（即所有尝试都失败了），返回最后记录的错误
    final_msg = f"\n--- 达到最大尝试次数 ({MAX_REQUEST_ATTEMPTS}) ---"
    send_status(final_msg)
    send_status(f"最终未能成功，最后记录的错误: {last_error_msg}")
    return last_error_msg
# --- CLI Functions ---
def auto_get_cookie_cli() -> Optional[str]:
    """
    启动 mitmproxy(如果未运行)，指导用户操作，并监控文件。
    返回 Cookie 字符串或 None。
    """
    # 1. 尝试启动 mitmproxy
    if not start_mitmproxy():
        print("无法启动 mitmproxy，自动获取 Cookie 失败。")
        return None # 返回 None，让主循环提示用户重试或手动输入

    # 2. 显示操作指南 (保持不变)
    print("\n请按以下步骤操作：")
    print(f"  1. Mitmproxy 应该已在后台启动。")
    if MITMPROXY_COMMAND == "mitmweb":
         print("     (可在 http://127.0.0.1:8081 查看流量)")
    print(f"  2. 【重要】请现在手动设置系统网络代理为: 127.0.0.1:8080")
    print(f"     (可使用 set_proxy.bat / set_proxy.sh 脚本)")
    print(f"  3. 打开【电脑版微信】并访问【图书馆小程序首页】以触发 Cookie 更新。")
    print(f"  4. 程序将自动检测位于 '{SCRIPT_DIR}' 目录下的 '{COOKIE_FILENAME}' 文件更新。")

    # --- 添加一个确认步骤，等待用户设置好代理 ---
    input("\n完成代理设置和微信操作后，请按 Enter 键开始监控 Cookie 文件...")
    print("\n正在等待 Cookie 文件更新...")

    # 3. 监控文件 (保持不变)
    start_time = time.time(); last_mtime = 0
    if os.path.exists(COOKIE_FILE_PATH):
        try: last_mtime = os.stat(COOKIE_FILE_PATH)[stat.ST_MTIME]
        except OSError: pass

    cookie_content = None
    while time.time() - start_time < MAX_WAIT_TIME:
        if os.path.exists(COOKIE_FILE_PATH):
            try:
                current_mtime = os.stat(COOKIE_FILE_PATH)[stat.ST_MTIME]
                if current_mtime > last_mtime:
                    print(f"\n检测到 '{COOKIE_FILENAME}' 文件更新！正在读取...")
                    time.sleep(0.5)
                    with open(COOKIE_FILE_PATH, "r", encoding='utf-8') as f:
                        cookie_content_read = f.read().strip()
                    if cookie_content_read and "=" in cookie_content_read:
                        print("Cookie 读取成功！")
                        cookie_content = cookie_content_read # 保存读取到的 cookie
                        break # 找到 cookie，退出监控循环
                    else:
                        print(f"警告：文件内容格式似乎不正确 ('{cookie_content_read[:50]}...')，继续等待...")
                        last_mtime = current_mtime
            except OSError as e: print(f"\n读取文件时出错: {e}，继续等待...")
            except Exception as e: print(f"\n处理文件时发生意外错误: {e}"); break # 停止等待

        if cookie_content: # 如果内层循环已找到cookie并break
             break

        print(".", end="", flush=True); time.sleep(FILE_CHECK_INTERVAL)

    # 4. 结果处理和提示取消代理
    if cookie_content:
         print("\n重要提示：现在可以取消系统网络代理设置了 (例如运行 unset_proxy.bat / unset_proxy.sh)。")
         # 不需要停止 mitmproxy，atexit 会处理
         return cookie_content
    else:
        print("\n等待超时或读取失败。未能自动获取 Cookie。")
        print("请确认 mitmproxy/代理/微信操作。")
        # 不需要停止 mitmproxy，atexit 会处理
        return None

def run_cli():
    """Runs the Command Line Interface version of the tool."""
    print("欢迎使用 图书馆抢座助手 (命令行版)")
    print("========================================")
    if not load_mappings() or not ROOM_ID_TO_NAME:
        print("错误：加载映射失败，无法继续。"); return

    while True: # Main loop for different reservation attempts
        # --- Get Mode ---
        mode = 0
        while mode not in [1, 2]:
            try:
                mode_input = input("\n请选择操作模式 (1: 明日预约, 2: 立即抢座): ").strip()
                mode = int(mode_input)
                if mode not in [1, 2]: print("无效输入。")
            except ValueError: print("无效输入，请输入数字。")
        mode_str = "明日预约" if mode == 1 else "立即抢座"
        print(f"\n已选择模式: {mode_str}")

        # --- Get Cookie ---
        cookie_str = ""; obtained_cookie = False
        while not obtained_cookie:
            print("\n请选择 Cookie 获取方式:")
            print("  1: 手动输入 Cookie")
            print("  2: 自动获取 Cookie (需配合 mitmproxy)")
            cookie_mode = input("请输入选项 (1 或 2): ").strip()
            if cookie_mode == '1':
                while not cookie_str:
                    cookie_str = input("请输入完整的 Cookie 字符串: ").strip()
                    if not cookie_str: print("Cookie 不能为空。")
                obtained_cookie = True
            elif cookie_mode == '2':
                cookie_str = auto_get_cookie_cli()
                if cookie_str: print(f"成功自动获取 Cookie: {cookie_str[:50]}..."); obtained_cookie = True
                else: print("未能自动获取 Cookie，请重试或选择手动输入。") # Loop back
            else: print("无效选项。")

        # --- Get Execution Time ---
        start_action_dt = None
        if mode == 1:
            while start_action_dt is None:
                start_str = TOMORROW_RESERVE_WINDOW_START.strftime('%H:%M:%S')
                end_str = TOMORROW_RESERVE_WINDOW_END.strftime('%H:%M:%S')
                time_str = input(f"请输入预约执行时间 (HH:MM:SS, 范围 {start_str}-{end_str}): ").strip()
                if validate_time_format(time_str): start_action_dt = calculate_execution_dt(time_str, check_window=True)
                else: print("时间格式错误。")
        else: # Mode 2
             time_str = input("请输入抢座执行时间 (HH:MM:SS, 留空则立即执行): ").strip()
             if not time_str: print("未指定时间，将立即执行。"); start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1)
             elif validate_time_format(time_str):
                 start_action_dt = calculate_execution_dt(time_str)
                 while start_action_dt is None: # Loop if invalid time entered
                     time_str = input("请重新输入抢座时间 (HH:MM:SS, 留空则立即执行): ").strip()
                     if not time_str: print("未指定时间，立即执行。"); start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1); break
                     elif validate_time_format(time_str):
                          start_action_dt = calculate_execution_dt(time_str)
                          if start_action_dt is None: print("无效时间或已过。")
                          else: break # Valid time entered
                     else: print("时间格式错误。")
             else: print("时间格式错误。将立即执行。"); start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1)

        # --- Get Library ID ---
        print("\n请选择阅览室:")
        available_rooms = sorted(ROOM_NAME_TO_ID.items(), key=lambda item: item[0]) # Sort by name
        for i, (name, _) in enumerate(available_rooms): print(f"  {i + 1}: {name}")
        lib_id_int = 0; chosen_room_name = ""
        while lib_id_int <= 0:
            try:
                choice = input(f"请输入阅览室序号 (1-{len(available_rooms)}): ").strip()
                choice_idx = int(choice) - 1
                if 0 <= choice_idx < len(available_rooms):
                    chosen_room_name, lib_id_str = available_rooms[choice_idx]; lib_id_int = int(lib_id_str)
                    print(f"已选择: {chosen_room_name} (ID: {lib_id_int})")
                else: print("序号无效。")
            except (ValueError, IndexError): print("输入无效或超出范围。")

        # --- Get Seat Key ---
        seat_key = ""; seat_map_for_room = SEAT_MAPPINGS.get(chosen_room_name)
        if not seat_map_for_room:
             print(f"\n警告: 未找到阅览室 '{chosen_room_name}' 的座位映射。")
             key_example = "44,43." if mode == 1 else "46,46"
             while not seat_key:
                 seat_key = input(f"请直接输入座位 Key (例如 {key_example}): ").strip()
                 if not seat_key: print("座位 Key 不能为空。")
        else:
            while not seat_key:
                 seat_number_input = input(f"请输入 '{chosen_room_name}' 的座位号 (例如 127): ").strip()
                 if not seat_number_input: print("座位号不能为空。"); continue
                 found_coordinate_key = seat_map_for_room.get(seat_number_input)
                 if found_coordinate_key is not None: seat_key = found_coordinate_key; print(f"座位号 {seat_number_input} -> Key: {seat_key}")
                 else:
                     print(f"错误: 在 '{chosen_room_name}' 未找到座位号 '{seat_number_input}'。")
                     available_keys = list(seat_map_for_room.keys())
                     if len(available_keys) < 50: print(f"可用座位号: {', '.join(sorted(available_keys))}")

        # --- Start Operation ---
        final_result = perform_seat_operation(mode, cookie_str, lib_id_int, seat_key, start_action_dt) # No callback needed for CLI

        # --- Handle Result ---
        if final_result == SEAT_TAKEN_ERROR_CODE: print("\n座位已被占用或预约，请重新选择。\n" + "="*40)
        else:
            print("\n--- 操作结束 ---"); print(f"最终结果: {final_result}"); print("-" * 40)
            try_again = input("是否要执行新的任务? (y/n): ").strip().lower()
            if try_again != 'y': break # Exit main CLI loop


# --- Web Server Code (Only if dependencies met) ---
# Global manager instance and templates defined conditionally
manager = None
templates = None

if WEB_DEPENDENCIES_MET and app: # Check if FastAPI and dependencies were imported AND app was initialized
    print("Web 依赖项已找到。Web 服务器功能已启用。")

    # --- Setup Jinja2 Templates ---
    if not os.path.isdir(TEMPLATES_DIR):
         print(f"警告: Templates 目录 '{TEMPLATES_DIR}' 未找到。Web 界面将无法加载。")
         templates = None
    else:
        try: templates = Jinja2Templates(directory=TEMPLATES_DIR); print("Jinja2Templates 初始化成功。")
        except Exception as e: print(f"错误: 初始化 Jinja2Templates 失败: {e}"); templates = None

    # --- ConnectionManager definition ---
    class ConnectionManager:
        def __init__(self): self.active_connections: Dict[str, WebSocket] = {} # type: ignore
        async def connect(self, websocket: WebSocket, client_id: str): await websocket.accept(); self.active_connections[client_id] = websocket; print(f"WebSocket connected: {client_id}") # type: ignore
        def disconnect(self, client_id: str):
            if client_id in self.active_connections: del self.active_connections[client_id]
            print(f"WebSocket disconnected: {client_id}")
        async def _send_json_safe(self, client_id: str, payload: dict):
            websocket = self.active_connections.get(client_id)
            if websocket:
                try: await websocket.send_json(payload)
                except Exception as e: print(f"Error sending WS ({payload.get('type', 'message')}) to {client_id}: {e}"); self.disconnect(client_id)
        async def send_status_update(self, client_id: str, message: str): await self._send_json_safe(client_id, {"type": "status", "message": message})
        async def send_final_result(self, client_id: str, status: str, message: str, error_code: Optional[str] = None):
            payload = {"type": "result", "status": status, "message": message};
            if error_code: payload["error_code"] = error_code
            await self._send_json_safe(client_id, payload)
        async def send_cookie_update(self, client_id: str, cookie: str): await self._send_json_safe(client_id, {"type": "cookie_update", "cookie": cookie})

    if WebSocket and asyncio: manager = ConnectionManager() # Instantiate manager
    else: manager = None; print("错误：无法初始化 ConnectionManager (缺少 WebSocket 或 asyncio)")

    # --- API Endpoint for Mappings ---
    @app.get("/api/mappings")
    async def get_mappings():
        if not ROOM_ID_TO_NAME:
             if not load_mappings(): raise HTTPException(status_code=500, detail="服务器无法加载阅览室映射数据。")
        sorted_rooms = dict(sorted(ROOM_ID_TO_NAME.items(), key=lambda item: item[1]))
        return {"rooms": sorted_rooms}

    # --- Pydantic Model ---
    if BaseModel and Field and validator: # Check required Pydantic parts
        class SeatRequestWeb(BaseModel):
            mode: int = Field(..., description="操作模式: 1-明日预约, 2-立即抢座")
            cookieStr: str = Field(..., description="用户 Cookie")
            timeStr: str = Field("", description="执行时间 (HH:MM:SS)")
            libId: int = Field(..., description="阅览室 ID")
            seatNumber: str = Field(..., description="用户输入的座位号")
            clientId: str = Field(..., description="WebSocket 客户端 ID")
            @validator('mode')
            def mode_must_be_1_or_2(cls, v):
                # 1. Check if None (e.g., if frontend sent null explicitly)
                if v is None:
                    raise ValueError('模式字段不能为空')
                # 2. Check if already int
                if isinstance(v, int):
                    if v not in [1, 2]:
                         raise ValueError('模式必须是 1 或 2')
                    return v
                # 3. Try converting if not int (e.g., frontend sent "1")
                try:
                    v_int = int(v)
                    if v_int not in [1, 2]:
                        raise ValueError('模式必须是 1 或 2')
                    return v_int # Return the converted integer
                except (ValueError, TypeError):
                     raise ValueError('模式必须是有效的整数 1 或 2')
            @validator('timeStr')
            def validate_time_web(cls, v, values):
                mode = values.get('mode'); time_str = v.strip()
                if mode == 1:
                    if not time_str: raise ValueError('明日预约模式必须提供执行时间 (HH:MM:SS)')
                    if not validate_time_format(time_str): raise ValueError('时间格式错误')
                    exec_dt = calculate_execution_dt(time_str, check_window=True)
                    if exec_dt is None: raise ValueError(f"预约时间 '{time_str}' 无效或不在窗口内/已过")
                elif mode == 2 and time_str:
                    if not validate_time_format(time_str): raise ValueError('时间格式错误')
                    exec_dt = calculate_execution_dt(time_str, check_window=False)
                    if exec_dt is None: raise ValueError(f"抢座时间 '{time_str}' 无效或已过")
                return time_str
    else: SeatRequestWeb = None; print("警告：Pydantic 模型未定义 (缺少依赖)")

    # --- Background Task Wrapper for Seat Operation ---
    # Needs BackgroundTasks, manager, perform_seat_operation
    if BackgroundTasks and manager and callable(perform_seat_operation):
        def run_seat_operation_task(client_id: str, mode: int, cookie: str, lib_id: int, seat_key: str, start_dt: Optional[datetime.datetime], background_tasks: BackgroundTasks): # type: ignore
            """Wrapper to run seat operation and send updates via WS."""
            def ws_status_callback_sync(message: str):
                if manager: background_tasks.add_task(manager.send_status_update, client_id, message)

            print(f"[Task {client_id}] Starting background operation...")
            final_result = perform_seat_operation(mode, cookie, lib_id, seat_key, start_dt, ws_status_callback_sync)
            print(f"[Task {client_id}] Background operation finished with result: {final_result}")

            status_code_ws = "success" if final_result.startswith("成功") else "error"
            user_message = final_result; error_code_ws = None
            if final_result == SEAT_TAKEN_ERROR_CODE:
                status_code_ws = "error"
                room_name_for_msg = ROOM_ID_TO_NAME.get(str(lib_id), f"ID {lib_id}")
                seat_num_for_msg = "[未知Key]"
                if room_name_for_msg in SEAT_MAPPINGS:
                     reverse_map = {v: k for k, v in SEAT_MAPPINGS[room_name_for_msg].items()}
                     seat_num_for_msg = reverse_map.get(seat_key, "[未知Key]")
                user_message = f"该座位 (阅览室: {room_name_for_msg}, 座位号: {seat_num_for_msg}) 已被占用，请重选。"
                error_code_ws = SEAT_TAKEN_ERROR_CODE
            if manager: background_tasks.add_task(manager.send_final_result, client_id, status_code_ws, user_message, error_code_ws)
    else: run_seat_operation_task = None; print("警告：座位操作后台任务包装器未定义 (缺少依赖)")

    # --- Background Task for Cookie Watching ---
    # Needs asyncio, os, time, stat, manager, etc.
    if asyncio and manager:
        async def watch_cookie_file_task(client_id: str):
            """
            Starts mitmproxy IF NEEDED, guides user, monitors cookie file,
            and sends updates via WS.
            """
            # --- 1. 尝试启动 mitmproxy (同步调用) ---
            # 注意：在异步函数中直接调用可能阻塞事件循环，但启动过程通常很快
            # 如果启动非常慢，考虑用 asyncio.to_thread (Python 3.9+)
            mitm_started = start_mitmproxy()

            # --- 2. 发送指南和状态 ---
            if not mitm_started:
                 if manager: await manager.send_status_update(client_id, "❌ 错误：无法启动 mitmproxy 监控进程。")
                 return # 无法继续

            # 发送操作指南
            instructions = [
                "--- 自动获取 Cookie 指南 ---",
                f"1. Mitmproxy ({MITMPROXY_COMMAND}) 应已在后台启动。",
                 "   (如果使用 mitmweb, 可在 http://127.0.0.1:8081 查看)",
                f"2. 【重要】请手动设置系统网络代理为: 127.0.0.1:8080",
                f"     (可使用 set_proxy.bat / set_proxy.sh 脚本)",
                f"3. 打开【电脑版微信】并访问【图书馆小程序首页】。",
                f"4. 程序正在后台监控 '{COOKIE_FILENAME}' 文件更新...",
                f"(最长等待 {MAX_WAIT_TIME} 秒，完成后请手动取消代理)"
            ]
            for instruction in instructions:
                if manager: await manager.send_status_update(client_id, instruction)
                await asyncio.sleep(0.1) # 异步函数中使用 asyncio.sleep

            # --- 3. 监控文件 ---
            start_time = time.time(); last_mtime = 0; cookie_found = False
            if os.path.exists(COOKIE_FILE_PATH):
                try: last_mtime = os.stat(COOKIE_FILE_PATH)[stat.ST_MTIME]
                except OSError: pass

            while time.time() - start_time < MAX_WAIT_TIME and not cookie_found:
                await asyncio.sleep(FILE_CHECK_INTERVAL) # 异步等待
                if os.path.exists(COOKIE_FILE_PATH):
                    try:
                        current_mtime = os.stat(COOKIE_FILE_PATH)[stat.ST_MTIME]
                        if current_mtime > last_mtime:
                            if manager: await manager.send_status_update(client_id, f"检测到 '{COOKIE_FILENAME}' 更新，读取中...")
                            await asyncio.sleep(0.5) # 异步等待
                            cookie_content = ""; read_error = None
                            try:
                                 # 文件 IO 是阻塞的，对于非常大的文件或慢速磁盘，
                                 # 理想情况下也应该用 asyncio.to_thread，但对于小 cookie 文件通常没问题
                                 with open(COOKIE_FILE_PATH, "r", encoding='utf-8') as f: cookie_content = f.read().strip()
                            except Exception as read_err: read_error = read_err
                            if read_error:
                                 print(f"Error reading cookie file: {read_error}")
                                 if manager: await manager.send_status_update(client_id, f"读取文件时出错: {read_error}")
                                 last_mtime = current_mtime; continue

                            if cookie_content and "=" in cookie_content:
                                if manager:
                                    await manager.send_status_update(client_id, "Cookie 读取成功！")
                                    await manager.send_cookie_update(client_id, cookie_content)
                                    await manager.send_status_update(client_id, "Cookie 已自动填充。")
                                    await manager.send_status_update(client_id, "提示：可取消系统代理。")
                                cookie_found = True # 成功获取，退出循环
                            else:
                                 if manager: await manager.send_status_update(client_id, f"警告：文件内容格式错误，继续等待...")
                                 last_mtime = current_mtime
                    except OSError as e:
                        if manager: await manager.send_status_update(client_id, f"检查文件状态出错: {e}...")
                    except Exception as e:
                        error_details = traceback.format_exc()
                        print(f"处理文件时意外错误: {e}\n{error_details}")
                        if manager: await manager.send_status_update(client_id, f"处理文件时意外错误: {e}")
                        break # 停止监控

            # --- 4. 超时处理 ---
            if not cookie_found and manager:
                await manager.send_status_update(client_id, f"等待 {MAX_WAIT_TIME} 秒超时，未能自动获取 Cookie。")
                await manager.send_status_update(client_id, "请检查操作或手动输入。")
            # 注意：不需要在这里停止 mitmproxy，atexit 会在主程序退出时处理

    else: watch_cookie_file_task = None; print("警告：Cookie监控后台任务未定义 (缺少依赖)")

    # --- API Endpoint for Seat Request ---
    if SeatRequestWeb and BackgroundTasks and run_seat_operation_task and HTTPException and JSONResponse and manager:
        @app.post("/api/submit_request")
        async def handle_seat_request(request: SeatRequestWeb, background_tasks: BackgroundTasks): # type: ignore
            """Handles seat request, validates, starts background task."""
            # Print received data with type check for mode
            print(f"\n收到 Web 请求: Client={request.clientId}, Mode={request.mode} (Type: {type(request.mode)}), LibID={request.libId}, SeatNo='{request.seatNumber}', Time='{request.timeStr}'")
            if not manager: raise HTTPException(status_code=503, detail="WebSocket管理器未初始化")

            lib_id_str = str(request.libId); room_name = ROOM_ID_TO_NAME.get(lib_id_str)
            if not room_name: raise HTTPException(status_code=404, detail=f"无效阅览室 ID ({request.libId})")
            seat_map_for_room = SEAT_MAPPINGS.get(room_name)
            if not seat_map_for_room: raise HTTPException(status_code=404, detail=f"未找到阅览室 '{room_name}' 座位图")
            seat_number_as_key = request.seatNumber.strip(); found_coordinate_key = seat_map_for_room.get(seat_number_as_key)

            if found_coordinate_key is None:
                raise HTTPException(status_code=404, detail=f"在 '{room_name}' 中未找到座位号 '{seat_number_as_key}'")
            print(f"查找成功: Room='{room_name}', SeatNo='{seat_number_as_key}' -> Key='{found_coordinate_key}'")
            start_action_dt_web = None
            try:
                if request.mode == 1:
                    start_action_dt_web = calculate_execution_dt(request.timeStr, check_window=True)
                    if start_action_dt_web is None: raise ValueError(f"预约时间 '{request.timeStr}' 无效")
                elif request.mode == 2 and request.timeStr:
                    start_action_dt_web = calculate_execution_dt(request.timeStr, check_window=False)
                    if start_action_dt_web is None: raise ValueError(f"抢座时间 '{request.timeStr}' 无效")
            except ValueError as e: raise HTTPException(status_code=400, detail=str(e))

            background_tasks.add_task( run_seat_operation_task, request.clientId, request.mode, request.cookieStr, request.libId, found_coordinate_key, start_action_dt_web, background_tasks)
            print(f"任务已添加: Client={request.clientId}, Key={found_coordinate_key}")
            return JSONResponse(content={"status": "processing", "message": "请求已提交后台处理，请通过 WebSocket 查看状态。"})
    else: print("警告：座位请求 API 端点 (/api/submit_request) 未定义 (缺少依赖)")

    # --- API Endpoint for Auto Cookie Get ---
    if BackgroundTasks and watch_cookie_file_task and manager and HTTPException and JSONResponse:
        @app.post("/api/start_auto_cookie_watch/{client_id}")
        async def start_auto_cookie_watch(client_id: str, background_tasks: BackgroundTasks): # type: ignore
            """Starts the background task to watch for the cookie file."""
            print(f"收到自动获取 Cookie 请求: Client={client_id}")
            if not manager: raise HTTPException(status_code=503, detail="WebSocket管理器未初始化")
            if client_id not in manager.active_connections: raise HTTPException(status_code=404, detail="客户端 WebSocket 未连接")
            background_tasks.add_task(watch_cookie_file_task, client_id)
            print(f"已为 Client={client_id} 添加 Cookie 监控任务。")
            return JSONResponse(content={"status": "watching", "message": "已启动 Cookie 文件监控，请查看状态区域指南。"})
    else: print("警告：自动 Cookie 获取 API 端点 (/api/start_auto_cookie_watch) 未定义 (缺少依赖)")

    # --- WebSocket Endpoint ---
    if WebSocket and WebSocketDisconnect and manager:
        @app.websocket("/ws/{client_id}")
        async def websocket_endpoint(websocket: WebSocket, client_id: str): # type: ignore
            if not manager: print("错误: WS 管理器未初始化"); return
            await manager.connect(websocket, client_id)
            try:
                while True: await websocket.receive_text() # Keep alive
            except WebSocketDisconnect: manager.disconnect(client_id)
            except Exception as e: print(f"WS 错误 for {client_id}: {type(e).__name__}"); manager.disconnect(client_id)
    else: print("警告：WebSocket 端点 (/ws/{client_id}) 未定义 (缺少依赖)")

    # --- HTML Frontend Endpoint ---
    if Request and Jinja2Templates and templates and HTTPException:
        @app.get("/")
        async def get_index(request: Request): # type: ignore
             if not templates: raise HTTPException(status_code=500, detail="模板引擎未初始化。")
             try: mappings_url = str(request.url_for('get_mappings'))
             except Exception: mappings_url = "/api/mappings" # Fallback
             context = { "request": request, "mappings_url": mappings_url,
                         "TOMORROW_RESERVE_WINDOW_START_STR": TOMORROW_RESERVE_WINDOW_START.strftime('%H:%M:%S'),
                         "TOMORROW_RESERVE_WINDOW_END_STR": TOMORROW_RESERVE_WINDOW_END.strftime('%H:%M:%S'),
                         "SEAT_TAKEN_ERROR_CODE": SEAT_TAKEN_ERROR_CODE }
             return templates.TemplateResponse("index.html", context)
    else: print("警告：主页 HTML 端点 (/) 未定义 (缺少依赖)")

# --- End of 'if WEB_DEPENDENCIES_MET and app:' block ---

# --- Main Execution Block ---
if __name__ == "__main__":
    run_web_flag = '--web' in sys.argv
    if run_web_flag:
        print("-" * 50); print("--- Web 服务器模式 ---")
        if not WEB_DEPENDENCIES_MET: sys.exit(1) # Message already printed
        if not app: print("\n❌ 错误：FastAPI 应用未能初始化。"); sys.exit(1)
        if not templates: print(f"\n❌ 错误: Templates 目录 '{TEMPLATES_DIR}' 缺失或初始化失败。"); sys.exit(1)
        if not manager: print(f"\n❌ 错误: WebSocket 管理器未能初始化。"); sys.exit(1)

        print("加载映射数据...")
        if not load_mappings() or not ROOM_ID_TO_NAME:
            print("\n❌ 错误: 加载映射数据失败，服务器无法启动。"); sys.exit(1)

        print("\n✅ Web 依赖项、模板和映射数据均已加载。")
        try: script_name = os.path.splitext(os.path.basename(__file__))[0]
        except NameError: script_name = "beta" # Fallback
        print(f"\n  请运行: uvicorn {script_name}:app --reload --host 0.0.0.0 --port 8000\n")
        print("(使用 --host 0.0.0.0 允许局域网访问)")
        print("启动后，在浏览器打开 http://<你的IP地址>:8000 或 http://127.0.0.1:8000")
        print("-" * 50)
        # Script exits here, user runs uvicorn manually

    else: # CLI Mode
        print("-" * 50); print("--- 命令行界面模式 ---")
        print("(使用 '--web' 参数运行以启动 Web 界面)")
        try: run_cli() # run_cli handles mapping loading internally now
        except KeyboardInterrupt: print("\n操作被用户中断。")
        except Exception as e: print(f"\n❌ 运行 CLI 时发生意外错误: {type(e).__name__} - {e}"); traceback.print_exc()
        finally: print("\n脚本执行完毕。")