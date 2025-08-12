# -*- coding: utf-8 -*-
"""
后台任务与全局状态管理模块

- 管理将被各模块共享的全局状态。
- 定义后台任务执行器，连接 Web 模块和 Core 模块。
"""
import asyncio
import datetime
import time
from typing import Dict, Optional, Tuple

from data_utils import load_mappings
from core import perform_seat_operation
from config import SEAT_TAKEN_ERROR_CODE

# --- 全局变量 ---
# 用于缓存从文件中加载的映射数据，避免重复读取
ROOM_ID_TO_NAME: Dict[str, str] = {}
ROOM_NAME_TO_ID: Dict[str, str] = {}
SEAT_MAPPINGS: Dict[str, Dict[str, str]] = {}

def load_and_get_mappings() -> Tuple[Dict[str, str], Dict[str, str], Dict[str, Dict[str, str]]]:
    """
    如果全局映射为空，则从文件加载数据，然后返回全局映射。
    这是一个辅助函数，主要由 web_app 模块调用，以确保数据只被加载一次。
    """
    global ROOM_ID_TO_NAME, ROOM_NAME_TO_ID, SEAT_MAPPINGS
    if not ROOM_ID_TO_NAME:
        print("全局映射为空，首次触发数据加载...")
        success, id_to_name, name_to_id, seat_maps = load_mappings()
        if success:
            ROOM_ID_TO_NAME = id_to_name
            ROOM_NAME_TO_ID = name_to_id
            SEAT_MAPPINGS = seat_maps
            print("数据加载并已缓存至全局变量。")
        else:
            print("警告：数据加载失败，全局映射仍为空。")
    return ROOM_ID_TO_NAME, ROOM_NAME_TO_ID, SEAT_MAPPINGS

def background_task_runner(
    client_id: str,
    mode: int,
    cookie: str,
    lib_id: int,
    seat_key: str,
    start_dt: Optional[datetime.datetime]
):
    """
    后台任务执行器。
    它被 web_app 的 FastAPI 后台任务调用，负责执行核心的抢座逻辑，
    并通过 WebSocket Manager 更新前端状态。
    """
    from web_app import manager

    def ws_status_callback_sync(message: str):
        if manager:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(manager.send_status_update(client_id, message))
            finally:
                loop.close()

    print(f"[后台任务 {client_id}] 开始执行...")
    load_and_get_mappings()
    
    now_dt = datetime.datetime.now()
    if start_dt and start_dt > now_dt:
        wait_seconds = (start_dt - now_dt).total_seconds()
        if wait_seconds > 0:
            ws_status_callback_sync(f"等待计划执行时间: {start_dt.strftime('%Y-%m-%d %H:%M:%S')}...")
            last_ws_update_time = time.time()
            while True:
                if manager.is_task_cancelled(client_id):
                    final_result = "任务已被用户取消"
                    break
                
                now_ts = time.time()
                remaining_seconds = start_dt.timestamp() - now_ts
                if remaining_seconds <= 0.01:
                    ws_status_callback_sync("\n时间到，开始执行！")
                    # 使用 break 跳出循环，继续执行下面的代码
                    final_result = perform_seat_operation(
                        mode, cookie, lib_id, seat_key, start_dt,
                        ROOM_ID_TO_NAME, SEAT_MAPPINGS,
                        ws_status_callback_sync, client_id
                    )
                    break
                
                if int(remaining_seconds * 2) != int((remaining_seconds - 0.1) * 2):
                    countdown_msg = f"距离计划执行时间还有 {remaining_seconds:.1f} 秒..."
                    ws_status_callback_sync(countdown_msg)
                
                time.sleep(max(0.005, min(0.1, remaining_seconds / 10)))
    else:
        # 如果没有设置时间，或者时间已过，立即执行
        final_result = perform_seat_operation(
            mode, cookie, lib_id, seat_key, start_dt,
            ROOM_ID_TO_NAME, SEAT_MAPPINGS,
            ws_status_callback_sync, client_id
        )

    print(f"[后台任务 {client_id}] 执行完毕，结果: {final_result}")

    status_code_ws = "success" if "成功" in final_result else "error"
    error_code_ws = SEAT_TAKEN_ERROR_CODE if final_result == SEAT_TAKEN_ERROR_CODE else None
    if "任务已被用户取消" in final_result:
        status_code_ws = "cancelled"

    if manager:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(manager.send_final_result(client_id, status_code_ws, final_result, error_code_ws))
        finally:
            loop.close()