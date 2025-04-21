# -*- coding: utf-8 -*-
import json
import time
import requests
import websocket # 需要安装 websocket-client
import datetime
import re
import sys
import os
import glob # For finding seat mapping files
from typing import Optional, Dict, Any, Tuple, List
import asyncio # Needed for the async callback handling in the wrapper
from fastapi import BackgroundTasks

# --- Configuration ---
URL = 'https://libseats.ldu.edu.cn/index.php/graphql/'
WEBSOCKET_URL = 'wss://libseats.ldu.edu.cn/ws?ns=prereserve/queue'
MAX_REQUEST_ATTEMPTS = 1 # 最大请求尝试次数
SLEEP_INTERVAL_ON_FAIL = 0.5
COOKIE_ERROR_PATTERN = r'Connection to remote host was lost|invalid session|请先登录|登陆|验证失败'
TOMORROW_RESERVE_WINDOW_START = datetime.time(19, 48, 0)
TOMORROW_RESERVE_WINDOW_END = datetime.time(23, 59, 59)
DEFAULT_RESERVE_TIME_STR = "21:48:00" # Default suggestion, not used directly in logic

# --- NEW: Data Mapping Configuration ---
# Assume 'data_process' directory is in the same folder as the script
try:
    # Handles running from script file
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    # Handles running in interactive mode or environments where __file__ is not defined
    SCRIPT_DIR = os.getcwd()
DATA_DIR = os.path.join(SCRIPT_DIR, 'data_process')
ROOM_MAPPINGS_FILE = os.path.join(DATA_DIR, 'room', 'output', 'room_mappings.json')
SEAT_MAPPINGS_DIR = os.path.join(DATA_DIR, 'seat', 'output')
# --- NEW: Template Directory ---
TEMPLATES_DIR = os.path.join(SCRIPT_DIR, 'templates') # Define template directory path

# Global variables to store loaded mappings
ROOM_ID_TO_NAME: Dict[str, str] = {}
ROOM_NAME_TO_ID: Dict[str, str] = {}
# Stores { room_name: { seat_number: seat_key } }
SEAT_MAPPINGS: Dict[str, Dict[str, str]] = {}
# Special return code for seat taken error
SEAT_TAKEN_ERROR_CODE = "SEAT_TAKEN"

# --- NEW: Data Loading Function ---
# ... (load_mappings function remains the same) ...
def load_mappings() -> bool:
    """Loads room and seat mappings from JSON files."""
    global ROOM_ID_TO_NAME, ROOM_NAME_TO_ID, SEAT_MAPPINGS
    print("正在加载阅览室和座位映射数据...")
    try:
        # Load Room Mappings
        if not os.path.exists(ROOM_MAPPINGS_FILE):
            print(f"错误: 阅览室映射文件未找到: {ROOM_MAPPINGS_FILE}")
            print("请确保 'data_process/room/output/room_mappings.json' 文件存在。")
            return False
        with open(ROOM_MAPPINGS_FILE, 'r', encoding='utf-8') as f:
            ROOM_ID_TO_NAME = json.load(f)
        ROOM_NAME_TO_ID = {v: k for k, v in ROOM_ID_TO_NAME.items()}
        print(f"成功加载 {len(ROOM_ID_TO_NAME)} 个阅览室映射。")

        # Load Seat Mappings
        seat_files = glob.glob(os.path.join(SEAT_MAPPINGS_DIR, '*.json'))
        if not seat_files:
             print(f"警告: 在 {SEAT_MAPPINGS_DIR} 未找到座位映射文件 (*.json)。将无法通过座位号选择。")
             # Continue without seat mappings if none are found
        else:
            loaded_seat_maps = 0
            for seat_file in seat_files:
                try:
                    # Extract room name from filename (remove .json)
                    room_name_from_file = os.path.splitext(os.path.basename(seat_file))[0]
                    # Verify this room name exists in our loaded room mappings
                    if room_name_from_file in ROOM_NAME_TO_ID:
                        with open(seat_file, 'r', encoding='utf-8') as f:
                            # Assumes format {"seat_number": "seat_key"}
                            seat_map = json.load(f)
                            if isinstance(seat_map, dict): # Basic validation
                                SEAT_MAPPINGS[room_name_from_file] = seat_map
                                loaded_seat_maps += 1
                            else:
                                print(f"警告: 座位文件 '{os.path.basename(seat_file)}' 内容格式不正确 (应为 JSON 对象)，已跳过。")

                    else:
                        print(f"警告: 座位文件 '{os.path.basename(seat_file)}' 对应的阅览室名称 '{room_name_from_file}' 在 room_mappings.json 中未找到，已跳过。")
                except json.JSONDecodeError:
                    print(f"错误: 解析座位映射文件失败: {seat_file}")
                except Exception as e:
                    print(f"加载座位文件 {seat_file} 时发生错误: {e}")
            if loaded_seat_maps > 0:
                print(f"成功加载 {loaded_seat_maps} 个阅览室的座位映射。")
            elif seat_files: # Files existed but none were loaded successfully
                print(f"警告: 找到了座位文件，但未能成功加载任何有效的座位映射。")


        if not ROOM_ID_TO_NAME:
            print("错误: 未能加载任何阅览室数据。")
            return False

        return True

    except FileNotFoundError:
        print(f"错误: 数据目录或文件未找到。请确保 '{DATA_DIR}' 结构正确且包含所需文件。")
        return False
    except json.JSONDecodeError:
        print(f"错误: 解析JSON映射文件失败。请检查文件格式: {ROOM_MAPPINGS_FILE}")
        return False
    except Exception as e:
        print(f"加载映射数据时发生未知错误: {e}")
        return False

# --- Default Payloads ---
# ... (payloads remain the same) ...
queue_header_base: Dict[str, str] = {
    'Host': 'libseats.ldu.edu.cn',
    'Connection': 'Upgrade',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/13603 Flue',
    'Upgrade': 'websocket',
    'Origin': 'https://libseats.ldu.edu.cn',
    'Sec-WebSocket-Version': '13',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Cookie': '' # Placeholder
}

pre_header_base: Dict[str, str] = {
    'Host': 'libseats.ldu.edu.cn',
    'Connection': 'keep-alive',
    # 'Content-Length': calculated by requests
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/13603 Flue',
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': 'https://libseats.ldu.edu.cn',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Referer': 'https://libseats.ldu.edu.cn/web/index.html',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Cookie': '' # Placeholder
}

# Payload Templates
data_template_tomorrow: Dict[str, Any] = {
    "operationName": "save",
    "query": "mutation save($key: String!, $libid: Int!, $captchaCode: String, $captcha: String) {\n userAuth {\n prereserve {\n save(key: $key, libId: $libid, captcha: $captcha, captchaCode: $captchaCode)\n }\n }\n}",
    "variables": {
        "key": "", # Placeholder (e.g., "44,43.")
        "libid": 0, # Placeholder for Tomorrow's Lib ID
        "captchaCode": "",
        "captcha": ""
    }
}

data_template_today: Dict[str, Any] = {
    "operationName": "reserveSeat",
    "query": "mutation reserveSeat($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: String!) {\n userAuth {\n reserve {\n reserveSeat(\n libId: $libId\n seatKey: $seatKey\n captchaCode: $captchaCode\n captcha: $captcha\n )\n }\n }\n}",
    "variables": {
        "seatKey": "", # Placeholder (e.g., "46,46")
        "libId": 0, # Placeholder for Today's Lib ID
        "captchaCode": "",
        "captcha": ""
    }
}

data_validate: Dict[str, Any] = {
    "operationName": "prereserve",
     "query": "query prereserve {\n userAuth {\n prereserve {\n prereserve {\n day\n lib_id\n seat_key\n seat_name\n is_used\n user_mobile\n id\n lib_name\n }\n }\n }\n}"
     # No variables needed for this query
}

data_lib_chosen_template: Dict[str, Any] = {
    "operationName": "libLayout",
    "query": "query libLayout($libId: Int!) {\n userAuth {\n prereserve {\n libLayout(libId: $libId) {\n max_x\n max_y\n seats_booking\n seats_total\n seats_used\n seats {\n key\n name\n seat_status\n status\n type\n x\n y\n }\n }\n }\n }\n}",
    "variables": {
        "libId": 0 # Placeholder
    }
}

# --- Helper Functions ---
# ... (extract_error_msg, pass_queue, validate_time_format, calculate_execution_dt, perform_seat_operation remain the same) ...
def extract_error_msg(response_text: str) -> str:
    """Extracts the error message from the JSON response."""
    try:
        data = json.loads(response_text)
        if "errors" in data and isinstance(data["errors"], list) and len(data["errors"]) > 0:
            error_info = data["errors"][0]
            if isinstance(error_info, dict) and "msg" in error_info:
                return str(error_info["msg"]) # Return decoded string
            elif isinstance(error_info, str):
                 # Try decoding if it looks like unicode escapes
                 try:
                     # Attempt to decode common web escape sequences
                     return error_info.encode('latin-1', 'backslashreplace').decode('unicode-escape')
                 except Exception:
                    return error_info # Return as is if decoding fails
        if "msg" in data and data["msg"]: # Check top-level msg
             return str(data["msg"])
        # Fallback if structure is unexpected but is valid JSON
        return response_text[:200] + ("..." if len(response_text) > 200 else "")

    except json.JSONDecodeError:
        # If it's not JSON, return the raw text snippet, trying to decode common escapes
        try:
            # Attempt common web escape decoding
            decoded_text = response_text.encode('latin-1', 'backslashreplace').decode('unicode-escape')
            return decoded_text[:200] + ("..." if len(decoded_text) > 200 else "")
        except Exception:
             # Fallback to returning raw text if decoding fails
            return response_text[:200] + ("..." if len(response_text) > 200 else "")
    except Exception as e:
        return f"解析错误信息时发生内部错误: {type(e).__name__} - {e}"

def pass_queue(ws_headers: Dict[str, str], status_callback=None) -> bool:
    """
    Simulates the WebSocket queueing process.
    Sends status updates via status_callback if provided.
    Returns True if queueing seems successful or already done, False otherwise.
    Raises ConnectionError if a Cookie issue is suspected.
    """

        # --- Define the helper function AT THE BEGINNING of pass_queue ---
    def send_status_pq(msg):
        print(msg) # Keep printing to console
        if status_callback:
            cleaned_msg = msg.strip().replace('\r', '')
            if cleaned_msg:
                try:
                    # Assuming status_callback uses background_tasks.add_task now
                    status_callback(cleaned_msg)
                except Exception as pq_cb_err:
                    # Log error but don't crash pass_queue
                    print(f"[Callback Error in pass_queue] {pq_cb_err}")
    # Helper to send status update if callback exists
    def send_status(msg):
        print(msg) # Keep printing to console
        if status_callback:
            # Remove potential '\r' from countdown messages for cleaner WS logs
            cleaned_msg = msg.strip().replace('\r', '')
            if cleaned_msg: # Avoid sending empty messages
                status_callback(cleaned_msg)

    send_status("\n================================")
    send_status("尝试进入排队通道...")
    ws = None
    is_success = False
    try:
        # ... (WebSocket connection logic) ...
        ws = websocket.create_connection(WEBSOCKET_URL, header=ws_headers, suppress_origin=True)

        if ws.connected:
            send_status('WebSocket 连接成功，开始排队...')
            ws.send('{"ns":"prereserve/queue","msg":""}')
            timeout_seconds = 10
            start_time = time.time()

            while time.time() - start_time < timeout_seconds:
                try:
                    receive_timeout = max(0.1, timeout_seconds - (time.time() - start_time))
                    ws.settimeout(receive_timeout)
                    raw_response = ws.recv()
                    decoded_response = raw_response
                    try:
                        msg_data = json.loads(raw_response)
                        decoded_response = msg_data.get('msg', raw_response)
                        send_status(f"服务器消息: {decoded_response}") # <--- Use helper
                    except json.JSONDecodeError:
                        try:
                           decoded_response = raw_response.encode('latin-1', 'backslashreplace').decode('unicode-escape')
                           send_status(f"排队中，服务器响应: {decoded_response}") # <--- Use helper
                        except Exception:
                           send_status(f"排队中，服务器原始响应: {raw_response}") # <--- Use helper

                    # Check for success indicators
                    if decoded_response == "ok" or "排队成功" in str(decoded_response) or "您已经预定了座位" in str(decoded_response) or "您已经预约了座位" in str(decoded_response):
                        send_status("排队成功或已完成预约。") # <--- Use helper
                        is_success = True
                        break
                    if "当前已经在队列中" in str(decoded_response):
                         send_status("已在队列中。") # <--- Use helper
                         is_success = True
                         break
                    if "验证失败" in str(decoded_response) or "invalid session" in str(decoded_response):
                         send_status("排队时检测到验证失败，可能Cookie已失效。") # <--- Use helper
                         raise ConnectionError("Cookie失效(WebSocket)，请更新Cookie.")
                    time.sleep(0.1)

                except websocket.WebSocketTimeoutException:
                    send_status(f"排队响应超时（等待 {receive_timeout:.1f} 秒后）。") # <--- Use helper
                    break
                except websocket.WebSocketConnectionClosedException as e:
                    # Defensive access to attributes or just print the exception string
                    code = getattr(e, 'code', 'N/A') # Get 'code' safely, default to 'N/A'
                    reason = getattr(e, 'reason', 'N/A') # Get 'reason' safely
                    # Use the send_status_pq helper defined within pass_queue
                    send_status_pq(f"WebSocket 连接在排队过程中关闭: Code={code}, Reason={reason} (Exception: {e})")
                    if code == 1006 or (reason and "Connection to remote host was lost" in reason):
                        send_status_pq("连接异常关闭，可能与Cookie有关。")
                    break # Exit inner loop on closed connection
                except Exception as e_inner:
                    # Use send_status_pq for other errors within the loop
                    send_status_pq(f"WebSocket 通信错误: {type(e_inner).__name__} - {e_inner}")
                    # Add traceback for debugging if needed
                    import traceback
                    send_status_pq(traceback.format_exc())
                    break # Exit inner loop on other errors

            if not is_success and time.time() - start_time >= timeout_seconds:
                 send_status("排队未在规定时间内确认成功。") # <--- Use helper
        else:
            send_status("WebSocket 连接失败。") # <--- Use helper

    except ConnectionRefusedError:
        send_status("WebSocket 连接被拒绝，请检查网络或服务器状态。") # <--- Use helper
    except websocket.WebSocketException as e:
        send_status(f"WebSocket 建立连接时出错: {e}") # <--- Use helper
        if re.search(COOKIE_ERROR_PATTERN, str(e), re.IGNORECASE):
            raise ConnectionError("Cookie失效(WebSocket Init)，请更新Cookie.")
    except ConnectionError as e:
        raise e
    except Exception as e_outer:
        send_status(f"排队过程中发生未知错误: {type(e_outer).__name__} - {e_outer}") # <--- Use helper
    finally:
        if ws and ws.connected:
            try:
                ws.close()
                send_status("WebSocket 连接已关闭。") # <--- Use helper
            except Exception as e_close:
                send_status(f"关闭WebSocket时出错: {e_close}") # <--- Use helper
        send_status("排队尝试结束。")
        send_status("================================")
    return is_success

def validate_time_format(time_str: str) -> bool:
    """Validates if the time string is in HH:MM:SS format."""
    return bool(re.match(r'^\d{2}:\d{2}:\d{2}$', time_str))

def calculate_execution_dt(time_str: str, check_window: bool = False) -> Optional[datetime.datetime]:
    """
    Calculates the execution datetime based on today's date and the time string.
    Optionally checks if the time falls within the TOMORROW_RESERVE_WINDOW (if check_window is True).
    Returns datetime object or None if invalid format or time condition not met.
    """
    now_dt = datetime.datetime.now()
    today_date = now_dt.date()

    try:
        exec_time = datetime.datetime.strptime(time_str, "%H:%M:%S").time()
    except ValueError:
        print(f"错误: 时间格式无效 '{time_str}'，应为 HH:MM:SS。")
        return None

    # Combine with today's date
    exec_dt = datetime.datetime.combine(today_date, exec_time)

    # Optional: Check if the time is within the required window for tomorrow's reservation
    if check_window:
        window_start_dt = datetime.datetime.combine(today_date, TOMORROW_RESERVE_WINDOW_START)
        window_end_dt = datetime.datetime.combine(today_date, TOMORROW_RESERVE_WINDOW_END)
        if not (window_start_dt <= exec_dt <= window_end_dt):
            print(f"错误: 预约模式的执行时间 {time_str} 不在允许的窗口内 "
                  f"({TOMORROW_RESERVE_WINDOW_START.strftime('%H:%M:%S')} - {TOMORROW_RESERVE_WINDOW_END.strftime('%H:%M:%S')})。")
            return None

    # Check if time is in the past (allow small buffer, e.g., 5 seconds)
    if exec_dt < now_dt - datetime.timedelta(seconds=5):
         print(f"错误: 指定的执行时间 {time_str} ({exec_dt.strftime('%Y-%m-%d %H:%M:%S')}) 已过。")
         return None

    print(f"计划执行时间已设置为: {exec_dt.strftime('%Y-%m-%d %H:%M:%S')}")
    return exec_dt

def perform_seat_operation(mode: int, cookie: str, lib_id: int, seat_key: str, start_action_dt: Optional[datetime.datetime], status_callback=None) -> str:
    """
    Performs the seat reservation/grabbing process.
    Waits until start_action_dt if provided.
    Handles specific errors like "Seat Taken" and "Not in Reservation Time".
    Sends detailed status updates via status_callback for each step.
    Returns "成功", SEAT_TAKEN_ERROR_CODE, or an error message string.
    """

    # --- Helper function to print to console AND send status via callback ---
    def send_status(msg: str):
        """Prints message to console and sends via status_callback if available."""
        print(msg) # Keep printing to console
        if status_callback:
            # Clean up message (remove carriage returns, leading/trailing whitespace)
            cleaned_msg = msg.strip().replace('\r', '')
            if cleaned_msg: # Avoid sending empty messages
                try:
                    # The actual sending (async call) is handled by the wrapper
                    # The wrapper provides a sync callback that schedules the async send
                    status_callback(cleaned_msg)
                except Exception as cb_err:
                    # Log callback error to console, but don't stop the main operation
                    print(f"[Callback Error] Failed to send status via callback: {cb_err}")

    mode_str = '预约' if mode == 1 else '抢座'
    room_name = ROOM_ID_TO_NAME.get(str(lib_id), f"ID {lib_id}")
    seat_number_str = "未知"
    if room_name in SEAT_MAPPINGS:
        reverse_seat_map = {v: k for k, v in SEAT_MAPPINGS[room_name].items()}
        seat_number_str = reverse_seat_map.get(seat_key, "未知Key")

    send_status(f"\n--- 开始执行 {mode_str} 操作 ---")
    send_status(f"模式: {'明日预约' if mode == 1 else '立即抢座'} | 阅览室: {room_name} ({lib_id}) | 座位: {seat_number_str} (Key: {seat_key})")

    is_immediate = True
    if start_action_dt:
        is_immediate = (start_action_dt <= datetime.datetime.now() + datetime.timedelta(seconds=2))
        exec_time_str = start_action_dt.strftime('%Y-%m-%d %H:%M:%S') if not is_immediate else '立即执行'
        send_status(f"计划执行时间: {exec_time_str}")
    else:
        send_status("计划执行时间: 立即执行")
        start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1)

    send_status("-" * 30)

    # --- Prepare Headers & Payloads ---
    current_pre_header = pre_header_base.copy()
    current_pre_header['Cookie'] = cookie
    current_queue_header = queue_header_base.copy()
    current_queue_header['Cookie'] = cookie

    try:
        data_lib_chosen = json.loads(json.dumps(data_lib_chosen_template))
        data_lib_chosen['variables']['libId'] = lib_id

        main_payload = None
        if mode == 1:
            main_payload = json.loads(json.dumps(data_template_tomorrow))
            main_payload['variables']['key'] = seat_key
            main_payload['variables']['libid'] = lib_id
        elif mode == 2:
            main_payload = json.loads(json.dumps(data_template_today))
            main_payload['variables']['seatKey'] = seat_key
            main_payload['variables']['libId'] = lib_id
        else:
            # Use send_status for internal errors too, then return
            err_msg = "内部错误：无效的操作模式"
            send_status(f"❌ {err_msg}")
            return err_msg

        data_validate_payload = json.loads(json.dumps(data_validate))

    except Exception as e:
         err_msg = f"内部错误：准备请求负载时发生错误: {e}"
         send_status(f"❌ {err_msg}")
         return err_msg

    # --- Handle Waiting ---
    now_dt = datetime.datetime.now()
    if start_action_dt and start_action_dt > now_dt:
        wait_seconds = (start_action_dt - now_dt).total_seconds()
        if wait_seconds > 0:
            wait_msg = f"等待计划执行时间: {start_action_dt.strftime('%Y-%m-%d %H:%M:%S')}..."
            send_status(wait_msg) # Send initial wait message
            last_ws_update_time = time.time()
            while True:
                now_ts = time.time()
                remaining_seconds = start_action_dt.timestamp() - now_ts
                if remaining_seconds <= 0.01:
                    send_status("\n时间到，开始执行！") # Send time's up message
                    break

                # Print countdown frequently to console
                countdown_msg_console = f"\r距离计划执行时间还有 {remaining_seconds:.1f} 秒..."
                print(countdown_msg_console, end="")

                # Send countdown update to WebSocket less frequently (e.g., every 0.5s)
                if status_callback and (now_ts - last_ws_update_time >= 0.5):
                     countdown_msg_ws = f"距离计划执行时间还有 {remaining_seconds:.1f} 秒..."
                     status_callback(countdown_msg_ws) # Direct call to callback here
                     last_ws_update_time = now_ts

                # Sleep adaptively
                sleep_duration = max(0.005, min(0.1, remaining_seconds / 5))
                time.sleep(sleep_duration)
            print() # Newline after console countdown finishes

    # --- Request Loop ---
    # Initialize last_error_msg for the case where the loop doesn't run or finishes without success
    last_error_msg = f"达到最大尝试次数({MAX_REQUEST_ATTEMPTS})仍未成功或未执行任何尝试。"
    session = requests.Session() # Use session for connection pooling

    for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
        attempt_msg = f"\n--- 第 {attempt}/{MAX_REQUEST_ATTEMPTS} 次尝试 ---"
        send_status(attempt_msg) # Use helper
        res = None
        text_res_validate = ""
        try:
            # 1. Pass Queue (WebSocket)
            step_msg = "步骤 1/5: 执行排队..."
            send_status(step_msg) # Use helper
            # Pass the callback down to pass_queue
            queue_success = pass_queue(current_queue_header, status_callback=status_callback)
            if not queue_success:
                 # Still send warning even if queue didn't explicitly succeed
                 send_status("警告: 排队步骤未显式确认成功，但仍继续尝试后续操作...") # Use helper
            else:
                send_status("排队步骤完成。") # Use helper

            # 2. Choose Library POST (HTTP)
            step_msg = f"步骤 2/5: 选择阅览室 ({room_name})..."
            send_status(step_msg) # Use helper
            response_lib_chosen = session.post(URL, headers=current_pre_header, json=data_lib_chosen, timeout=10)
            send_status(f"  - 选择阅览室响应状态: {response_lib_chosen.status_code}") # Use helper
            response_lib_chosen.raise_for_status() # Check for HTTP errors (4xx, 5xx)

            # 3. Main Action POST (Reserve/Grab) (HTTP)
            step_msg = f"步骤 3/5: 执行 {mode_str} 操作 (座位 {seat_number_str})..."
            send_status(step_msg) # Use helper
            time.sleep(0.1) # Small delay might be helpful
            res = session.post(URL, headers=current_pre_header, json=main_payload, timeout=15)
            send_status(f"  - 主操作响应状态: {res.status_code}") # Use helper
            main_action_text = res.text # Get text before potential raise_for_status

            # 4. Validation POST (HTTP)
            step_msg = "步骤 4/5: 发送验证请求..."
            send_status(step_msg) # Use helper
            response_validate = session.post(URL, headers=current_pre_header, json=data_validate_payload, timeout=10)
            send_status(f"  - 验证响应状态: {response_validate.status_code}") # Use helper
            text_res_validate = response_validate.text
            response_validate.raise_for_status() # Check for HTTP errors

            # 5. Check Result based on Main Action Response (Step 3)
            step_msg = "步骤 5/5: 检查主操作结果..."
            send_status(step_msg) # Use helper

            main_action_failed = False
            error_msg_main = ""
            try:
                res.raise_for_status()
                # If no HTTP error, check JSON content for "errors" key
                main_action_failed = '"errors":' in main_action_text
            except requests.exceptions.HTTPError as http_err:
                 send_status(f"  - 主操作返回 HTTP 错误: {http_err}") # Use helper
                 main_action_failed = True # Treat HTTP error as failure
                 error_msg_main = extract_error_msg(main_action_text)
                 send_status(f"  - HTTP 错误响应体信息: {error_msg_main}") # Use helper
                 last_error_msg = f"主操作HTTP错误: {http_err} - {error_msg_main}"
                 # Check for cookie error pattern even in HTTP error responses
                 combined_texts_for_cookie_check = main_action_text + text_res_validate + error_msg_main + str(http_err)
                 if re.search(COOKIE_ERROR_PATTERN, combined_texts_for_cookie_check, re.IGNORECASE):
                     last_error_msg = "Cookie失效或验证失败(HTTP错误)，请更新Cookie。"
                     send_status(f"❌ 失败: {last_error_msg}") # Use helper
                     return last_error_msg # Exit immediately
                 # Continue to retry logic below if it's not a cookie error

            if not main_action_failed:
                # Check if the response *looks* like success
                try:
                    main_action_data = json.loads(main_action_text)
                    success_indicator = False
                    if mode == 1 and main_action_data.get("data", {}).get("userAuth", {}).get("prereserve", {}).get("save") is not None:
                        success_indicator = True
                    elif mode == 2 and main_action_data.get("data", {}).get("userAuth", {}).get("reserve", {}).get("reserveSeat") is not None:
                         success_indicator = True

                    if success_indicator:
                        success_msg = f"✅ {mode_str}成功 (主操作响应状态 {res.status_code}, 内容符合预期)"
                        send_status("******************************")
                        send_status(success_msg)
                        send_status("******************************\n")
                        # Return "成功", the wrapper will send the final WS result
                        return "成功"
                    else:
                         # Response had no "errors" but didn't match expected success structure
                         last_error_msg = f"主操作响应码 {res.status_code} 但内容格式非预期成功格式。响应: {main_action_text[:150]}..."
                         send_status(f"  - 警告: {last_error_msg}") # Use helper
                         # Treat unexpected format as a failure for retry purposes

                except json.JSONDecodeError:
                    last_error_msg = f"主操作响应码 {res.status_code} 但响应非JSON格式: {main_action_text[:150]}..."
                    send_status(f"❌ 失败: {last_error_msg}") # Use helper
                    # Treat non-JSON as failure for retry

            else: # main_action_failed is True (contains "errors" or HTTP error occurred)
                # If error_msg_main wasn't set during HTTPError handling, extract it now
                if not error_msg_main:
                    error_msg_main = extract_error_msg(main_action_text)
                send_status(f"  - 主操作响应包含错误或HTTP错误，提取信息: {error_msg_main}") # Use helper

                # --- Specific Error Checks ---

                # --- !!! NEW: Check for "Access Denied!" specifically !!! ---
                # Check if the extracted error message is exactly "Access Denied!" or contains it
                # Adjust the condition based on the exact error message format
                if "access denied" in error_msg_main.lower(): # Case-insensitive check
                    access_denied_msg = "检测到 'Access Denied!' 错误，这通常表示 Cookie 无效或已过期。"
                    send_status(f"❌ {access_denied_msg}") # Log specific reason
                    # Return a specific code or user-friendly message for the wrapper to handle
                    # Option 1: Return a specific code
                    # return "COOKIE_INVALID_OR_EXPIRED"
                    # Option 2: Return the user-friendly message directly (Simpler for this case)
                    return "Cookie无效或已过期，请检查并更新Cookie后重试。"
                # --- End of New Check ---

                # --- Existing Specific Error Checks ---
                if "不在预约时间内" in error_msg_main:
                    final_error = f"❌ {mode_str}失败: 不在预约/抢座时间段内。"
                    send_status(final_error) # Use helper
                    return final_error # Exit immediately, no retry needed

                if "该座位已经被人预定了" in error_msg_main or "您选择的座位已被预约" in error_msg_main or "已被占座" in error_msg_main:
                    final_error = f"❌ {mode_str}失败: 该座位 (座位 {seat_number_str}) 已经被人预定了或已被占座。"
                    send_status(final_error) # Use helper
                    return SEAT_TAKEN_ERROR_CODE # Return special code

                success_keywords = ["您已经预约了座位", "您已经预定了座位", "操作成功", "当前已有有效预约"]
                is_already_success_msg = any(keyword in error_msg_main for keyword in success_keywords)
                if is_already_success_msg:
                     success_msg = f"✅ {mode_str}成功 (检测到确认性消息: {error_msg_main})"
                     send_status("******************************")
                     send_status(success_msg)
                     send_status("******************************\n")
                     return f"成功 ({error_msg_main})"

                # General failure if no specific case matched (and not Access Denied)
                last_error_msg = f"主操作错误: {error_msg_main}"
                # Check for general Cookie errors using the pattern (if not already caught by Access Denied)
                combined_texts_for_cookie_check = main_action_text + text_res_validate + error_msg_main
                if re.search(COOKIE_ERROR_PATTERN, combined_texts_for_cookie_check, re.IGNORECASE):
                     last_error_msg = "Cookie失效或验证失败，请更新Cookie。"
                     send_status(f"❌ 失败: {last_error_msg}") # Use helper
                     return last_error_msg # Exit immediately

                # If we reach here, it's a retryable failure for this attempt
                send_status(f"❌ 第 {attempt} 次尝试失败: {last_error_msg}") # Use helper


        except requests.exceptions.Timeout as e:
            last_error_msg = f"请求超时 ({e})"
            send_status(f"❌ 第 {attempt} 次尝试失败: {last_error_msg}") # Use helper
        except requests.exceptions.RequestException as e:
            last_error_msg = f"网络请求错误: {e}"
            send_status(f"❌ 第 {attempt} 次尝试失败: {last_error_msg}") # Use helper
            # Check for cookie errors indicated by network exceptions
            if re.search(COOKIE_ERROR_PATTERN, str(e), re.IGNORECASE):
                 last_error_msg = "Cookie失效(请求异常)，请更新Cookie。"
                 send_status("检测到可能的Cookie失效（请求异常）。") # Use helper
                 send_status(f"❌ 失败: {last_error_msg}") # Use helper
                 return last_error_msg # Exit immediately
        except ConnectionError as e: # Propagated from pass_queue() for WebSocket Cookie errors
             last_error_msg = str(e) # Should already contain "Cookie失效(WebSocket)..."
             send_status(f"❌ 第 {attempt} 次尝试失败 (来自排队): {last_error_msg}") # Use helper
             return last_error_msg # Exit immediately
        except Exception as e:
            # Catch unexpected errors during the process
            import traceback
            error_details = traceback.format_exc()
            last_error_msg = f"发生未知错误: {type(e).__name__} - {e}"
            send_status(f"❌ 第 {attempt} 次尝试中失败: {last_error_msg}") # Use helper
            send_status(f"详细错误追踪: \n{error_details}") # Send traceback details too
            # Check for cookie errors in generic exceptions too
            if re.search(COOKIE_ERROR_PATTERN, str(e), re.IGNORECASE):
                 last_error_msg = "Cookie失效(未知异常)，请更新Cookie。"
                 send_status("检测到可能的Cookie失效（未知异常）。") # Use helper
                 send_status(f"❌ 失败: {last_error_msg}") # Use helper
                 return last_error_msg # Exit immediately

        # --- Retry Logic ---
        # Only reach here if the attempt failed with a retryable error
        if attempt < MAX_REQUEST_ATTEMPTS:
            retry_msg = f"等待 {SLEEP_INTERVAL_ON_FAIL} 秒后重试..."
            send_status(retry_msg) # Use helper
            time.sleep(SLEEP_INTERVAL_ON_FAIL)
        else:
            # If it was the last attempt, last_error_msg should hold the error from the last failed attempt
            pass # The loop will end, and last_error_msg will be returned

    # --- Loop End ---
    # This part is reached only if all attempts failed without returning earlier
    final_msg = f"\n--- 达到最大尝试次数 ({MAX_REQUEST_ATTEMPTS}) ---"
    send_status(final_msg) # Use helper
    send_status(f"最终未能成功，最后记录的错误: {last_error_msg}") # Send the final error context
    # The wrapper function (`run_seat_operation_task`) will use this returned error message
    # to send the final 'error' result via WebSocket.
    return last_error_msg

# --- Main Execution (Command Line Interface) ---
# ... (run_cli function remains the same) ...
def run_cli():
    print("欢迎使用图书馆座位预约/抢座脚本 (命令行版)")
    print("===========================================")

    # --- Load Mappings ---
    # Loading is done before calling run_cli in __main__

    # --- Main Loop for Re-selection on Seat Taken ---
    while True: # Loop allows re-selecting room/seat if taken

        # --- Get Mode ---
        mode = 0
        while mode not in [1, 2]:
            try:
                mode_input = input("\n请选择操作模式 (1: 明日预约, 2: 立即抢座): ").strip()
                mode = int(mode_input)
                if mode not in [1, 2]:
                    print("无效输入，请输入 1 或 2。")
            except ValueError:
                print("无效输入，请输入数字 1 或 2。")
        mode_str = "明日预约" if mode == 1 else "立即抢座"
        print(f"\n已选择模式: {mode_str}")

        # --- Get Cookie ---
        cookie_str = ""
        while not cookie_str:
            cookie_str = input("请输入 Cookie: ").strip()
            if not cookie_str:
                print("Cookie 不能为空。")

        # --- Get Execution Time ---
        start_action_dt = None
        if mode == 1:
            # Mode 1 (Tomorrow): Time is required and must be in the window
            while start_action_dt is None:
                time_str = input(f"请输入预约执行时间 (HH:MM:SS, 范围 {TOMORROW_RESERVE_WINDOW_START.strftime('%H:%M:%S')}-{TOMORROW_RESERVE_WINDOW_END.strftime('%H:%M:%S')}), 例如 21:48:00: ").strip()
                if validate_time_format(time_str):
                    # Pass check_window=True for mode 1
                    start_action_dt = calculate_execution_dt(time_str, check_window=True)
                else:
                    print("时间格式错误，应为 HH:MM:SS。")
        else:
            # Mode 2 (Today): Time is optional
            time_str = input("请输入抢座执行时间 (HH:MM:SS, 留空则立即执行): ").strip()
            if not time_str:
                print("未指定时间，将立即执行。")
                start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1) # Ensure immediate start
            elif validate_time_format(time_str):
                # Pass check_window=False (default) for mode 2
                start_action_dt = calculate_execution_dt(time_str)
                if start_action_dt is None:
                     print("请重新输入有效的时间或留空。")
                     # Loop back to ask for time again
                     # Corrected logic: stay in a loop until valid time or empty is given for mode 2
                     while start_action_dt is None:
                         time_str = input("请重新输入抢座执行时间 (HH:MM:SS, 留空则立即执行): ").strip()
                         if not time_str:
                             print("未指定时间，将立即执行。")
                             start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1)
                             break # Exit time loop
                         elif validate_time_format(time_str):
                              start_action_dt = calculate_execution_dt(time_str)
                              if start_action_dt is None:
                                  print("无效时间或已过。") # calculate_execution_dt prints details
                              else:
                                   break # Exit time loop
                         else:
                             print("时间格式错误，应为 HH:MM:SS。")

            else:
                 print("时间格式错误，应为 HH:MM:SS。将立即执行。")
                 start_action_dt = datetime.datetime.now() - datetime.timedelta(seconds=1)


        # --- NEW: Get Library ID using Name Selection ---
        print("\n请选择阅览室:")
        # Sort rooms by name for easier selection
        available_rooms = sorted(ROOM_NAME_TO_ID.items(), key=lambda item: item[0]) # List of (name, id) tuples
        for i, (name, _) in enumerate(available_rooms):
            print(f"  {i + 1}: {name}")

        lib_id_int = 0
        chosen_room_name = ""
        while lib_id_int <= 0:
            try:
                choice = input(f"请输入阅览室序号 (1-{len(available_rooms)}): ").strip()
                choice_idx = int(choice) - 1
                if 0 <= choice_idx < len(available_rooms):
                    chosen_room_name, lib_id_str = available_rooms[choice_idx]
                    lib_id_int = int(lib_id_str) # Convert to int for API payload
                    print(f"已选择: {chosen_room_name} (ID: {lib_id_int})")
                else:
                    print("输入无效，请输入列表中的序号。")
            except ValueError:
                print("输入无效，请输入数字序号。")
            except IndexError:
                 print("输入序号超出范围。")

        # --- NEW: Get Seat Key using Seat Number Input ---
        seat_key = "" # This will store the found coordinate key (e.g., "44,46")
        seat_map_for_room = SEAT_MAPPINGS.get(chosen_room_name)

        if not seat_map_for_room:
             # This case remains the same - if the room has no map loaded at all
             print(f"\n警告: 未找到阅览室 '{chosen_room_name}' 的座位映射数据。")
             key_example = "44,43." if mode == 1 else "46,46" # Example might vary
             seat_key_label = f"座位 Key (例如 {key_example})"
             while not seat_key:
                 seat_key = input(f"请直接输入{seat_key_label}: ").strip()
                 if not seat_key: print("座位 Key 不能为空。")
        else:
            # Ask for seat number and use it as the key to find the coordinate key
            while not seat_key:
                 # Get seat number input from user
                 seat_number_input = input(f"请输入 '{chosen_room_name}' 的座位号 (例如 127): ").strip()
                 if not seat_number_input:
                     print("座位号不能为空。")
                     continue

                 # Directly use seat number as key to lookup the coordinate key (value)
                 found_coordinate_key = seat_map_for_room.get(seat_number_input)

                 if found_coordinate_key is not None:
                     seat_key = found_coordinate_key # Assign the found value ("44,46")
                     print(f"座位号 {seat_number_input} 对应的坐标 Key: {seat_key}")
                     # Exit the loop since we found it
                 else:
                     print(f"错误: 在 '{chosen_room_name}' 的映射中未找到座位号 '{seat_number_input}' 作为键。请检查输入或座位映射文件。")
                     # Optionally list available seat numbers (keys)
                     available_keys = list(seat_map_for_room.keys())
                     if len(available_keys) < 50:
                         print(f"可用座位号 (根据映射文件): {', '.join(sorted(available_keys))}")
                     # Loop continues to ask for seat number again

        # --- Start the Operation ---
        # *** CRITICAL: Pass the CORRECT seat_key (the coordinate key found) ***
        final_result = perform_seat_operation(mode, cookie_str, lib_id_int, seat_key, start_action_dt)

        # --- Handle Result ---
        if final_result == SEAT_TAKEN_ERROR_CODE:
            print("\n座位已被占用或预约，请重新选择阅览室和座位。\n" + "="*30)
            # The loop will continue, prompting for mode/cookie/time/room/seat again
        else:
            # Success or other failure
            print("\n--- 操作结束 ---")
            print(f"最终结果: {final_result}")
            print("-" * 30)
            try_again = input("是否要执行新的预约/抢座任务? (y/n): ").strip().lower()
            if try_again != 'y':
                break # Exit the main loop

# --- Web Dependencies and App Definition ---
try:
    from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
    from fastapi.responses import JSONResponse # HTMLResponse removed, TemplateResponse added
    from fastapi.templating import Jinja2Templates # Import Jinja2Templates
    from pydantic import BaseModel, validator, Field
    import uvicorn
    import asyncio # For WebSocket status updates and potentially to_thread
    from typing import Any # Import Any if needed below

    WEB_DEPENDENCIES_MET = True
    # Define app only if dependencies are met
    app = FastAPI(title="图书馆座位助手", description="用于预约或抢座图书馆座位")
    # ... potentially define manager, templates etc. here inside try block ...

    # --- NEW: Setup Jinja2 Templates ---
    # Make sure TEMPLATES_DIR is defined correctly above
    if not os.path.isdir(TEMPLATES_DIR):
         print(f"警告: Templates 目录 '{TEMPLATES_DIR}' 未找到。Web 界面将无法加载。")
         # Optionally raise an error or handle it differently
         templates = None # Indicate templates aren't loaded
    else:
        templates = Jinja2Templates(directory=TEMPLATES_DIR)


    # --- NEW: WebSocket Connection Manager ---
    # ... (ConnectionManager class remains the same) ...
    class ConnectionManager:
        def __init__(self):
            # Stores mapping of client_id to WebSocket connection
            self.active_connections: Dict[str, WebSocket] = {} # type: ignore

        async def connect(self, websocket: WebSocket, client_id: str): # type: ignore
            await websocket.accept()
            self.active_connections[client_id] = websocket
            print(f"WebSocket connected: {client_id}")

        def disconnect(self, client_id: str):
            if client_id in self.active_connections:
                # Optional: Clean close before deleting?
                # try:
                #    await self.active_connections[client_id].close()
                # except: pass # Ignore errors on close
                del self.active_connections[client_id]
                print(f"WebSocket disconnected: {client_id}")

        async def send_status_update(self, client_id: str, message: str):
            websocket = self.active_connections.get(client_id)
            if websocket:
                try:
                    await websocket.send_json({"type": "status", "message": message})
                except Exception as e:
                    print(f"Error sending WS status message to {client_id}: {e}")
                    # Consider disconnecting on send error
                    self.disconnect(client_id)

        async def send_final_result(self, client_id: str, status: str, message: str, error_code: Optional[str] = None):
             websocket = self.active_connections.get(client_id)
             if websocket:
                payload = {"type": "result", "status": status, "message": message}
                if error_code:
                    payload["error_code"] = error_code
                try:
                    await websocket.send_json(payload)
                except Exception as e:
                    print(f"Error sending final WS result to {client_id}: {e}")
                    self.disconnect(client_id) # Disconnect if final result can't be sent

    manager = ConnectionManager()

except ImportError:
    # --- Only set the flag and define minimal dummies if absolutely necessary ---
    WEB_DEPENDENCIES_MET = False

    # Remove re-assignment of BackgroundTasks and others imported above
    # BackgroundTasks = None # type: ignore <--- REMOVE THIS LINE

    # Keep dummies for things *only* used if dependencies fail, if any.
    # Most dummies might not be needed if subsequent code checks WEB_DEPENDENCIES_MET
    FastAPI = None
    Request = Any # type: ignore
    BaseModel = None
    JSONResponse = None
    HTTPException = None
    WebSocket = Any # type: ignore
    WebSocketDisconnect = Any # type: ignore
    uvicorn = None
    asyncio = None # type: ignore
    app = None
    manager = None # type: ignore # Assuming manager is defined in try block now
    Field = lambda default, **kwargs: default
    Jinja2Templates = None
    templates = None # type: ignore # Assuming templates is defined in try block now

    # Print an error message indicating missing dependencies
    print("\n❌ 错误：运行 Web 界面需要 FastAPI 相关依赖库，但未能成功导入。")
    print("请确保已安装: pip install fastapi uvicorn jinja2 pydantic")
    print("Web 服务器功能将不可用。\n")


# --- Define Web Routes ONLY if dependencies are met ---
if WEB_DEPENDENCIES_MET and app:
    print("Web 依赖项已找到。Web 服务器功能已启用。")

    # --- ConnectionManager definition (should be outside try/except or checked) ---
    # Assuming ConnectionManager needs WebSocket, define it conditionally or ensure WebSocket dummy is sufficient
    if WebSocket and asyncio: # Check needed base types exist (even if dummies)
        class ConnectionManager:
            # ... (rest of ConnectionManager definition) ...
            manager = ConnectionManager() # Instantiate only if dependencies met
    else:
        # If manager is needed elsewhere, assign a dummy or handle appropriately
        manager = None

    # --- API Endpoint for Mappings ---
    # ... (get_mappings endpoint remains the same) ...
    @app.get("/api/mappings")
    async def get_mappings():
        # Ensure mappings are loaded; try loading if empty
        if not ROOM_ID_TO_NAME or not ROOM_NAME_TO_ID:
             print("Web request for mappings found them unloaded, attempting to load...")
             if not load_mappings():
                  # Log the error server-side
                  print("Error: Failed to load mappings for /api/mappings request.")
                  # Return an error response to the client
                  raise HTTPException(status_code=500, detail="服务器无法加载阅览室映射数据，请检查服务器日志。")

        # Return rooms (id -> name) sorted by name for dropdown consistency
        sorted_rooms = dict(sorted(ROOM_ID_TO_NAME.items(), key=lambda item: item[1])) # Sort by name
        return {"rooms": sorted_rooms}

    # --- Pydantic Model for Web Request ---
    # ... (SeatRequestWeb model remains the same) ...
    class SeatRequestWeb(BaseModel):
        mode: int = Field(..., description="操作模式: 1-明日预约, 2-立即抢座")
        cookieStr: str = Field(..., description="用户 Cookie")
        timeStr: str = Field("", description="执行时间 (HH:MM:SS), 模式1必填, 模式2可选")
        libId: int = Field(..., description="阅览室 ID (来自下拉列表)")
        seatNumber: str = Field(..., description="用户输入的座位号")
        clientId: str = Field(..., description="WebSocket 客户端 ID for status updates")

        @validator('mode')
        def mode_must_be_1_or_2(cls, v):
            if v not in [1, 2]:
                raise ValueError('模式必须是 1 或 2')
            return v

        # Combined validator for time based on mode
        @validator('timeStr')
        def validate_time_web(cls, v, values):
            # 'values' contains the already validated fields (like 'mode')
            mode = values.get('mode')
            time_str = v.strip() # Use stripped value

            if mode == 1: # Tomorrow reservation
                if not time_str:
                    raise ValueError('明日预约模式必须提供执行时间 (HH:MM:SS)')
                if not validate_time_format(time_str):
                    raise ValueError('时间格式错误，应为 HH:MM:SS')
                # Use calculate_execution_dt for window and past time check
                exec_dt = calculate_execution_dt(time_str, check_window=True)
                if exec_dt is None:
                     # calculate_execution_dt prints specific errors, raise a generic one here
                     raise ValueError(f"无效的预约执行时间 '{time_str}' (请检查格式、是否在预约窗口内且未过时)")
            elif mode == 2: # Today grab
                if time_str: # Time is optional for mode 2
                    if not validate_time_format(time_str):
                        raise ValueError('时间格式错误，应为 HH:MM:SS')
                    # Use calculate_execution_dt to check if time is in the past
                    exec_dt = calculate_execution_dt(time_str, check_window=False)
                    if exec_dt is None:
                         raise ValueError(f"无效的抢座执行时间 '{time_str}' (请检查格式或时间是否已过)")

            return time_str # Return original validated string

    # --- Background Task Wrapper ---
    # ... (run_seat_operation_task function remains the same) ...
    def run_seat_operation_task(client_id: str, mode: int, cookie: str, lib_id: int, seat_key: str, start_dt: Optional[datetime.datetime], background_tasks: BackgroundTasks):
        """Wrapper to run the blocking operation and send status/final result via WebSocket,
    using BackgroundTasks for status updates."""
        # Define the async callback function *inside* this sync wrapper
        # This ensures it can capture the client_id and use the global manager
        async def ws_status_callback_async(message: str):
            # This function needs to be async to call manager.send_status_update
            await manager.send_status_update(client_id, message)

        # Create a sync version of the callback that runs the async one
        # This is needed because perform_seat_operation expects a sync callback
        # NOTE: This requires an available asyncio event loop in the thread where this runs.
        # Uvicorn typically provides this for background tasks.
        def ws_status_callback_sync(message: str):
            # Use the passed background_tasks object to schedule the async send
            # manager.send_status_update is an async function
            background_tasks.add_task(manager.send_status_update, client_id, message)
            # No need for explicit loop handling or run_coroutine_threadsafe here

        print(f"[Task {client_id}] Starting background operation...")
        # Pass the NEW ws_status_callback_sync to the operation function
        final_result = perform_seat_operation(
            mode, cookie, lib_id, seat_key, start_dt, ws_status_callback_sync
        )
        print(f"[Task {client_id}] Background operation finished with result: {final_result}")

        # --- Determine final status and message (Same as before) ---
        status_code_ws = "success" if final_result.startswith("成功") else "error"
        user_message = final_result
        error_code_ws = None
        room_name_for_msg = ROOM_ID_TO_NAME.get(str(lib_id), f"ID {lib_id}") # Use helper map

        if final_result == SEAT_TAKEN_ERROR_CODE:
            status_code_ws = "error" # It's an error state for the user action
            # Try to find seat number again for message
            seat_num_for_msg = "[未知Key]"
            if room_name_for_msg in SEAT_MAPPINGS:
                reverse_map = {v: k for k, v in SEAT_MAPPINGS[room_name_for_msg].items()}
                seat_num_for_msg = reverse_map.get(seat_key, "[未知Key]")
            user_message = f"该座位 (阅览室: {room_name_for_msg}, 座位号: {seat_num_for_msg}) 已经被预定了，请选择其他座位。"
            error_code_ws = SEAT_TAKEN_ERROR_CODE
        elif final_result.startswith("成功"):
            status_code_ws = "success"
        else: # Any other error message
            status_code_ws = "error"

        # --- Send final result (Still needs async execution) ---
        # Using background_tasks for the final send as well is consistent
        background_tasks.add_task(manager.send_final_result, client_id, status_code_ws, user_message, error_code_ws)

        # # Send final result via WebSocket (needs to be done async)
        # async def send_final_async():
        #     await manager.send_final_result(client_id, status_code_ws, user_message, error_code_ws)

        # try:
        #     loop = asyncio.get_running_loop()
        # except RuntimeError:
        #     loop = asyncio.new_event_loop()
        #     asyncio.set_event_loop(loop)
        # asyncio.run_coroutine_threadsafe(send_final_async(), loop)


    # Assume FastAPI app and other dependencies are defined

    @app.post("/api/submit_request")
    async def handle_seat_request(request: SeatRequestWeb, background_tasks: BackgroundTasks): # Type hint needed
        """
        Handles seat request, validates, looks up key, and starts background task.
        Passes the background_tasks object to the task runner.
        """
        print(f"\n收到 Web 请求: Client={request.clientId}, Mode={request.mode}, LibID={request.libId}, Input SeatNo='{request.seatNumber}', Time='{request.timeStr}'")

        # --- Lookups and validation (Same as before) ---
        lib_id_str = str(request.libId)
        room_name = ROOM_ID_TO_NAME.get(lib_id_str)
        if not room_name:
            raise HTTPException(status_code=404, detail=f"提供的阅览室 ID ({request.libId}) 无效")

        seat_map_for_room = SEAT_MAPPINGS.get(room_name)
        if not seat_map_for_room:
            raise HTTPException(status_code=404, detail=f"服务器端未找到阅览室 '{room_name}' 的座位映射数据")

        seat_number_as_key = request.seatNumber.strip()
        found_coordinate_key = seat_map_for_room.get(seat_number_as_key)

        print(f"DEBUG (Web): Looking up key '{seat_number_as_key}' in map for '{room_name}'...")

        if found_coordinate_key is None:
            print(f"错误 (Web): 在阅览室 '{room_name}' (ID: {request.libId}) 的映射中未能找到座位号 '{seat_number_as_key}' 作为键。")
            available_keys = list(seat_map_for_room.keys())
            print(f"DEBUG (Web): Available seat numbers (keys) in map for '{room_name}' (sample): {available_keys[:20]}")
            raise HTTPException(status_code=404, detail=f"在阅览室 '{room_name}' 中未找到座位号 '{seat_number_as_key}'。")

        print(f"查找成功 (Web): Room='{room_name}', Input SeatNo='{seat_number_as_key}' -> Found Coordinate Key='{found_coordinate_key}'")

        start_action_dt_web = None
        try:
            if request.mode == 1:
                start_action_dt_web = calculate_execution_dt(request.timeStr, check_window=True)
                if start_action_dt_web is None: raise ValueError(f"预约时间 '{request.timeStr}' 无效或已过时。")
            elif request.mode == 2 and request.timeStr:
                start_action_dt_web = calculate_execution_dt(request.timeStr, check_window=False)
                if start_action_dt_web is None: raise ValueError(f"抢座时间 '{request.timeStr}' 无效或已过时。")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # --- MODIFIED Add Task Call ---
        # Pass the background_tasks object itself as the last argument
        background_tasks.add_task(
            run_seat_operation_task,
            request.clientId,
            request.mode,
            request.cookieStr,
            request.libId,
            found_coordinate_key,
            start_action_dt_web,
            background_tasks # Pass the object here
        )

        print(f"任务已添加到后台 (Web): Client={request.clientId}, CoordinateKey={found_coordinate_key}")
        # Return immediate HTTP confirmation (Same as before)
        return JSONResponse(content={"status": "processing", "message": "请求已提交后台处理，请通过 WebSocket 查看状态更新和最终结果。"})

    # --- WebSocket Endpoint ---
    # ... (websocket_endpoint remains the same) ...
    @app.websocket("/ws/{client_id}")
    async def websocket_endpoint(websocket: WebSocket, client_id: str): # type: ignore
        await manager.connect(websocket, client_id)
        try:
            while True:
                # Keep connection alive by waiting for messages (or periodic pings if needed)
                # We don't expect the client to send anything specific in this setup.
                data = await websocket.receive_text()
                # print(f"Received WS message from {client_id}: {data}") # For debugging client pings etc.
                # Optional: Respond to pings if client sends them
                # if data == "ping": await websocket.send_text("pong")
        except WebSocketDisconnect:
            print(f"WebSocket disconnected by client: {client_id}")
            manager.disconnect(client_id)
        except Exception as e:
            print(f"WebSocket error for {client_id}: {type(e).__name__} - {e}")
            # Ensure disconnect is called even on other errors
            manager.disconnect(client_id)


    # --- HTML Frontend (Using Jinja2 Template) ---
    # --- MODIFIED: Use TemplateResponse ---
    @app.get("/") # Removed response_class=HTMLResponse
    async def get_index(request: Request): # type: ignore # Renamed request_http to request, added type hint
         """Serves the main HTML page using a Jinja2 template."""
         if not templates:
             # Handle case where template directory wasn't found during startup
              raise HTTPException(status_code=500, detail="服务器模板引擎未正确初始化。")

         try:
            mappings_url = str(request.url_for('get_mappings'))
         except Exception as e:
             print(f"Error generating URL for 'get_mappings': {e}")
             # Fallback or raise error, here we provide a default path
             mappings_url = "/api/mappings" # Ensure this matches the actual API path

         # Prepare context data for the template
         context = {
             "request": request, # Mandatory for Jinja2Templates
             "mappings_url": mappings_url,
             "TOMORROW_RESERVE_WINDOW_START_STR": TOMORROW_RESERVE_WINDOW_START.strftime('%H:%M:%S'),
             "TOMORROW_RESERVE_WINDOW_END_STR": TOMORROW_RESERVE_WINDOW_END.strftime('%H:%M:%S'),
             "SEAT_TAKEN_ERROR_CODE": SEAT_TAKEN_ERROR_CODE,
         }

         # Return the rendered template
         return templates.TemplateResponse("index.html", context)

# --- Main Execution Block ---
if __name__ == "__main__":

    run_web_flag = '--web' in sys.argv

    if run_web_flag:
        print("-" * 50)
        print("--- Web 服务器模式 ---")
        if not WEB_DEPENDENCIES_MET:
            print("\n❌ 错误：运行 Web 界面需要额外的依赖库。")
            print("请先安装所需依赖:")
            # Added jinja2
            print("  pip install fastapi uvicorn websocket-client requests pydantic jinja2")
            print("-" * 50)
            sys.exit(1)

        if not app:
             print("\n❌ 错误：FastAPI 应用未能初始化。")
             sys.exit(1)
        # Check if templates were loaded
        if not templates:
             print(f"\n❌ 错误: Templates 目录 '{TEMPLATES_DIR}' 不存在或无法访问。Web 服务器无法启动。")
             sys.exit(1)

        # Load mappings before starting server
        print("正在加载映射数据以启动 Web 服务器...")
        if not load_mappings():
              print("\n❌ 错误: 无法加载映射文件，Web服务器无法启动。请检查 data_process 目录和文件。")
              sys.exit(1)
        if not ROOM_ID_TO_NAME:
             print("\n❌ 错误: 阅览室数据为空，Web服务器无法提供有效服务。")
             sys.exit(1)

        print("\n✅ Web 界面依赖项已找到、模板已加载且映射数据已加载。")
        print("请在你的终端中运行以下命令来启动 Web 服务器:")
        try:
            # Get the filename of the current script without the extension
            script_name = os.path.splitext(os.path.basename(__file__))[0]
        except NameError:
            # Fallback if run interactively (e.g., in Jupyter or Python console)
            # Try getting it from sys.argv if possible, otherwise use a placeholder
            try:
                script_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]
                if not script_name or script_name == "-c": # Handle python -c "..." case
                    script_name = "your_script_filename"
            except Exception:
                script_name = "your_script_filename"


        # Recommend uvicorn command
        print(f"\n  uvicorn {script_name}:app --reload --host 0.0.0.0 --port 8000\n")
        print("(使用 --host 0.0.0.0 允许局域网内其他设备访问，如果只需本机访问，可改为 --host 127.0.0.1)")
        print(f"(确保此 Python 文件名为 {script_name}.py 且 templates 目录位于同一文件夹下)")
        print("启动后，请在浏览器中打开 http://<你的IP地址>:8000 或 http://127.0.0.1:8000")
        print("-" * 50)
        # The script finishes here; the user needs to run the uvicorn command separately.

    else: # CLI Mode
        print("-" * 50)
        print("--- 命令行界面模式 ---")
        print("(如果需要 Web 界面，请使用 '--web' 参数运行此脚本)")

        # Load mappings for CLI mode
        print("正在加载映射数据...")
        if not load_mappings():
            print("\n❌ 错误：无法加载映射文件，程序退出。请检查 data_process 目录和文件。")
            sys.exit(1)
        if not ROOM_ID_TO_NAME:
             print("\n❌ 错误：阅览室数据为空，无法执行操作。")
             sys.exit(1)

        print("-" * 50)
        try:
            run_cli() # Start the command-line interface
        except KeyboardInterrupt:
             print("\n操作被用户中断。")
        except Exception as e:
            print(f"\n❌ 运行命令行界面时发生意外错误: {type(e).__name__} - {e}")
            import traceback
            traceback.print_exc() # Print detailed traceback for debugging
        finally:
            print("\n脚本执行完毕。")