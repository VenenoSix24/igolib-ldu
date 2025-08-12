# -*- coding: utf-8 -*-
"""
核心逻辑模块 (最终优化版)

本版本优化了重试逻辑，当遇到不可恢复的业务错误时将立即停止。
"""
import json
import re
import time
import requests
import datetime
import websocket
import traceback

from typing import Any, Callable, Dict, Optional


from config import (
    URL, WEBSOCKET_URL, MAX_REQUEST_ATTEMPTS, SLEEP_INTERVAL_ON_FAIL,
    COOKIE_ERROR_PATTERN, SEAT_TAKEN_ERROR_CODE,
    TOMORROW_RESERVE_WINDOW_START, TOMORROW_RESERVE_WINDOW_END,
    data_template_tomorrow, data_template_today, data_validate,
    data_lib_chosen_template, queue_header_base, pre_header_base
)

# --- 辅助函数 ---
def extract_error_msg(response_text: str) -> str:
    try:
        data = json.loads(response_text)
        errors = data.get("errors")
        if errors and isinstance(errors, list) and errors:
            error_info = errors[0]
            msg = error_info.get("msg", str(error_info))
            return msg.encode('latin-1', 'backslashreplace').decode('unicode-escape', 'replace') if isinstance(msg, str) else str(msg)
        msg = data.get("msg")
        if msg: return str(msg)
        return response_text[:200]
    except Exception:
        return response_text[:200]

def pass_queue(mode: int, ws_headers: Dict[str, str], status_callback: Optional[Callable[[str], None]] = None) -> bool:
    def send_status_pq(msg: str):
        print(msg)
        if status_callback: status_callback(msg.strip().replace('\r', ''))

    send_status_pq("\n================================")
    send_status_pq("尝试进入排队通道...")
    ws = None
    is_success = False
    try:
        ws = websocket.create_connection(WEBSOCKET_URL, header=ws_headers, suppress_origin=True, timeout=10)
        send_status_pq('WebSocket 连接成功。')
        if mode == 1:
            send_status_pq('明日预约模式：连接成功即视为排队完成。')
            is_success = True
        else:
            send_status_pq('立即抢座模式：开始等待服务器确认消息...')
            ws.send('{"ns":"prereserve/queue","msg":""}')
            timeout_seconds = 15
            start_time = time.time()
            while time.time() - start_time < timeout_seconds:
                try:
                    receive_timeout = max(0.1, timeout_seconds - (time.time() - start_time))
                    ws.settimeout(receive_timeout)
                    raw_response = ws.recv()
                    msg_data = json.loads(raw_response)
                    decoded_response = msg_data.get('msg', raw_response)
                    send_status_pq(f"服务器消息: {decoded_response}")
                    decoded_lower = str(decoded_response).lower()
                    if any(keyword in decoded_lower for keyword in ["ok", "排队成功", "您已经预定了座位"]):
                        send_status_pq("排队成功或已在队列/已完成预约。")
                        is_success = True
                        break
                except Exception:
                    send_status_pq(f"收到非预期消息，视为排队成功。")
                    is_success = True
                    break
    except Exception as e_outer:
        send_status_pq(f"排队过程中发生连接错误: {e_outer}")
        if re.search(COOKIE_ERROR_PATTERN, str(e_outer), re.IGNORECASE):
            raise ConnectionError("Cookie失效(WebSocket)，请更新。")
    finally:
        if ws:
            try: ws.close(); send_status_pq("WebSocket 连接已关闭。")
            except: pass
        send_status_pq("排队尝试结束。"); send_status_pq("================================")
    return is_success

def validate_time_format(time_str: str) -> bool:
    return bool(re.match(r'^\d{2}:\d{2}:\d{2}$', time_str))

def calculate_execution_dt(time_str: str, check_window: bool = False) -> Optional[datetime.datetime]:
    now_dt = datetime.datetime.now()
    try: exec_time = datetime.datetime.strptime(time_str, "%H:%M:%S").time()
    except ValueError: return None
    if time_str == "00:00:01": return now_dt
    exec_dt = datetime.datetime.combine(now_dt.date(), exec_time)
    if check_window and not (TOMORROW_RESERVE_WINDOW_START <= exec_time <= TOMORROW_RESERVE_WINDOW_END): return None
    if exec_dt < now_dt - datetime.timedelta(seconds=5): return None
    return exec_dt

# --- 核心操作函数 ---
def perform_seat_operation(
    mode: int, cookie: str, lib_id: int, seat_key: str, start_action_dt: Optional[datetime.datetime],
    room_mappings: Dict[str, str], seat_mappings: Dict[str, Dict[str, str]],
    status_callback: Optional[Callable[[str], None]] = None, client_id: Optional[str] = None
) -> str:
    def send_status(msg: str):
        print(msg)
        if status_callback: status_callback(msg.strip().replace('\r', ''))
    
    mode_str = '预约' if mode == 1 else '抢座'
    room_name = room_mappings.get(str(lib_id), f"ID {lib_id}")
    seat_number_str = "未知"
    if room_name in seat_mappings:
        reverse_seat_map = {v: k for k, v in seat_mappings[room_name].items()}
        seat_number_str = reverse_seat_map.get(seat_key, "未知Key")

    send_status(f"\n--- 开始执行 {mode_str} 操作 ---")
    send_status(f"模式: {'明日预约' if mode == 1 else '立即抢座'} | 阅览室: {room_name} ({lib_id}) | 座位: {seat_number_str} (Key: {seat_key})")
    
    last_error_msg = f"达到最大尝试次数({MAX_REQUEST_ATTEMPTS})仍未成功。"
    session = requests.Session()
    
    for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
        send_status(f"\n--- 第 {attempt}/{MAX_REQUEST_ATTEMPTS} 次尝试 ---")
        if attempt > 1:
            send_status(f"等待 {SLEEP_INTERVAL_ON_FAIL} 秒后重试...")
            time.sleep(SLEEP_INTERVAL_ON_FAIL)
        
        current_pre_header = pre_header_base.copy(); current_pre_header['Cookie'] = cookie
        current_queue_header = queue_header_base.copy(); current_queue_header['Cookie'] = cookie
        main_payload_template = data_template_tomorrow if mode == 1 else data_template_today
        main_payload = json.loads(json.dumps(main_payload_template))
        if mode == 1:
            main_payload['variables']['key'] = seat_key; main_payload['variables']['libid'] = lib_id
        else:
            main_payload['variables']['seatKey'] = seat_key; main_payload['variables']['libId'] = lib_id
        data_lib_chosen = json.loads(json.dumps(data_lib_chosen_template)); data_lib_chosen['variables']['libId'] = lib_id
        data_validate_payload = json.loads(json.dumps(data_validate))

        try:
            if mode == 1:
                send_status("步骤 1/5: 执行排队...");
                queue_success = pass_queue(mode, current_queue_header, status_callback=status_callback)
                if not queue_success: send_status("警告: 排队未确认成功，但将继续尝试后续HTTP操作...")
                else: send_status("排队步骤完成。")
            else:
                send_status("步骤 1/5: 跳过排队 (立即抢座模式)")

            send_status(f"步骤 2/5: 选择阅览室 ({room_name})...");
            res_lib = session.post(URL, headers=current_pre_header, json=data_lib_chosen, timeout=10)
            send_status(f"  - 选择阅览室响应: {res_lib.status_code}")
            res_lib.raise_for_status()
            
            send_status(f"步骤 3/5: 执行 {mode_str} (座位 {seat_number_str})...");
            time.sleep(0.1)
            res_main = session.post(URL, headers=current_pre_header, json=main_payload, timeout=15)
            send_status(f"  - 主操作响应: {res_main.status_code}")
            
            send_status("步骤 4/5: 发送验证请求...");
            res_val = session.post(URL, headers=current_pre_header, json=data_validate_payload, timeout=10)
            send_status(f"  - 验证响应: {res_val.status_code}")

            send_status("步骤 5/5: 检查主操作结果...");
            res_main.raise_for_status()
            
            if '"errors":' in res_main.text:
                error_msg_main = extract_error_msg(res_main.text)
                last_error_msg = f"主操作错误: {error_msg_main}"
                send_status(f"  - {last_error_msg}")
                
                permanent_errors = ["不在预约时间内", "日不开放"]
                if any(err in error_msg_main for err in permanent_errors):
                    send_status("检测到不可恢复的业务错误，操作终止。")
                    return f"操作失败: {error_msg_main}" # 直接返回，不再重试

                if "access denied" in error_msg_main.lower(): return "Cookie无效或已过期，请更新。"
                if any(err in error_msg_main for err in ["该座位已经被人预定了", "您选择的座位已被预约", "已被占座"]): return SEAT_TAKEN_ERROR_CODE
                if any(keyword in error_msg_main for keyword in ["您已经预约了座位", "操作成功"]): return f"成功 ({error_msg_main})"
                
                send_status(f"❌ 第 {attempt} 次尝试失败: {last_error_msg}")
            else:
                send_status(f"✅ {mode_str}成功！")
                return "成功"
        except Exception as e:
            last_error_msg = f"在第 {attempt} 次尝试中发生异常: {e}"
            send_status(f"❌ {last_error_msg}")
            # 对于网络等异常，继续重试
    
    send_status(f"\n--- 达到最大尝试次数 ({MAX_REQUEST_ATTEMPTS}) ---")
    send_status(f"最终未能成功，最后记录的错误: {last_error_msg}")
    return last_error_msg