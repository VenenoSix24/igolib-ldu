# tasks.py
"""
后台任务与全局状态管理模块

- 管理将被各模块共享的全局状态。
- 定义后台任务执行器，连接 Web 模块和 Core 模块。
"""
import asyncio
import datetime
import time
import logging
from typing import Optional

from core import perform_seat_operation
from config import SEAT_TAKEN_ERROR_CODE
from achievements import update_stats_on_success
import globals

logger = logging.getLogger(__name__)

def background_task_runner(
    client_id: str,
    mode: int,
    cookie: str,
    lib_id: int,
    seat_key: str,
    start_dt: Optional[datetime.datetime]
):
    from web_app import manager

    def ws_status_callback_sync(message: str):
        if manager:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(manager.send_status_update(client_id, message))
            except Exception as e:
                logger.error(f"后台任务回调中发送WebSocket消息失败: {e}")
            finally:
                loop.close()

    logger.info(f"[后台任务 {client_id}] 开始执行...")

    final_result = ""
    now_dt = datetime.datetime.now()

    if start_dt and start_dt > now_dt:
        ws_status_callback_sync(f"等待计划执行时间: {start_dt.strftime('%Y-%m-%d %H:%M:%S')}...")
        while True:
            if manager.is_task_cancelled(client_id):
                ws_status_callback_sync("❌ 任务已被用户取消")
                manager.clear_cancelled_task(client_id)
                final_result = "任务已被用户取消"
                break
            
            now_ts = time.time()
            remaining_seconds = start_dt.timestamp() - now_ts
            
            if remaining_seconds <= 0.01:
                ws_status_callback_sync("\n时间到，开始执行！")
                final_result = perform_seat_operation(
                    mode, cookie, lib_id, seat_key, start_dt,
                    globals.ROOM_ID_TO_NAME, globals.SEAT_MAPPINGS,
                    ws_status_callback_sync, client_id
                )
                break
            
            if int(remaining_seconds * 2) != int((remaining_seconds - 0.1) * 2):
                countdown_msg = f"距离计划执行时间还有 {remaining_seconds:.1f} 秒..."
                ws_status_callback_sync(countdown_msg)
            
            time.sleep(max(0.005, min(0.1, remaining_seconds / 10)))
    else:
        final_result = perform_seat_operation(
            mode, cookie, lib_id, seat_key, start_dt,
            globals.ROOM_ID_TO_NAME, globals.SEAT_MAPPINGS,
            ws_status_callback_sync, client_id
        )

    logger.info(f"[后台任务 {client_id}] 执行完毕，结果: {final_result}")

    if "成功" in final_result:
        try:
            # 需要从全局变量中获取本次成功的阅览室名称
            room_name = globals.ROOM_ID_TO_NAME.get(str(lib_id), "未知阅览室")
            update_stats_on_success(room_name)
        except Exception as e:
            # 即使统计失败，也不应影响主流程，只记录错误即可
            logger.error(f"更新统计数据时发生错误: {e}", exc_info=True)

    status_code_ws = "success" if "成功" in final_result else "error"
    if "任务已被用户取消" in final_result:
        status_code_ws = "cancelled"
    
    error_code_ws = SEAT_TAKEN_ERROR_CODE if final_result == SEAT_TAKEN_ERROR_CODE else None
    
    if manager:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(manager.send_final_result(client_id, status_code_ws, final_result, error_code_ws))
        finally:
            loop.close()