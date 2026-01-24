"""
后台任务与全局状态管理模块 (Async Refactor)
- 升级为 Asyncio 协程，非阻塞运行
- 彻底解决线程池耗尽问题
- 优化了内存占用和 CPU 占用
"""
import asyncio
import datetime
import time
import logging
import json
import pytz
from typing import Optional

from core import perform_seat_operation
from config import SEAT_TAKEN_ERROR_CODE
import globals

logger = logging.getLogger(__name__)


def create_status_message(event: str, message: str, data: dict = None) -> str:
    """
    创建结构化状态消息 (JSON 格式)
    
    Args:
        event: 事件类型 (countdown, phase, success, error, warning, info, retry, cancelled)
        message: 用户友好的消息文案
        data: 附加数据 (可选)
    
    Returns:
        JSON 格式的消息字符串
    """
    payload = {"event": event, "message": message}
    if data:
        payload["data"] = data
    return json.dumps(payload, ensure_ascii=False)

# 定义北京时区
BEIJING_TZ = pytz.timezone('Asia/Shanghai')

async def background_task_runner(
    client_id: str,
    mode: int,
    cookie: str,
    lib_id: int,
    seat_key: str,
    start_dt: Optional[datetime.datetime],
    api_url: str = "",
    origin: str = "",
    referer: str = ""
):
    """
    异步后台任务执行器。
    由 FastAPI 的 BackgroundTasks 调度 (在 Event Loop 中运行)。
    """
    from web_app import manager

    # 定义异步回调 wrapper
    # 注意：core.py 中的 perform_seat_operation 接受的 callback 是 sync 还是 async？
    # 在 core.py 重构中，status_callback 被定义为 Optional[Callable[[str], None]]
    # 并且在 perform_seat_operation 内部是直接调用的: status_callback(msg)
    # 所以我们需要传一个同步函数，但这个同步函数需要能触发 async 动作 (websocket send)。
    # 由于我们在 async 上下文中，直接 create_task 即可。

    def ws_status_callback_sync(message: str):
        # 这是一个被 core.py (async func) 同步调用的回调
        # 为了不阻塞 core.py 的微小执行间隙，我们 fire-and-forget 发送任务
        if manager:
            asyncio.create_task(manager.send_status_update(client_id, message))

    # 辅助：直接异步发送 (用于本模块内部)
    async def send_status(message: str):
        if manager:
            await manager.send_status_update(client_id, message)

    logger.info(f"[后台任务 {client_id}] (Async) 开始执行...")
    final_result = ""
    
    # 统一获取带时区的当前时间
    now_dt = datetime.datetime.now(BEIJING_TZ)

    # 如果 start_dt 是从数据库或前端传来的 naive 格式，强制转为北京时间
    if start_dt and start_dt.tzinfo is None:
        start_dt = BEIJING_TZ.localize(start_dt)

    if start_dt and start_dt > now_dt:
        # 计算剩余时间
        remaining_seconds = start_dt.timestamp() - now_dt.timestamp()
        target_time_str = start_dt.strftime("%H:%M:%S")
        
        # 发送任务启动消息
        await send_status(create_status_message(
            "phase", 
            f"任务已启动，等待 {target_time_str} 执行",
            {"phase": "waiting", "target_time": target_time_str}
        ))
        
        while True:
            # 1. 检查任务取消
            if manager.is_task_cancelled(client_id):
                await send_status(create_status_message(
                    "cancelled",
                    "任务已取消",
                    {"phase": "cancelled"}
                ))
                manager.clear_cancelled_task(client_id)
                final_result = "任务已被用户取消"
                break
            
            # 2. 计算剩余时间
            now_ts = time.time()
            remaining_seconds = start_dt.timestamp() - now_ts
            display_sec = int(remaining_seconds)
            
            # 3. 触发条件
            if remaining_seconds <= 0.01:
                await send_status(create_status_message(
                    "phase",
                    "时间到，正在执行...",
                    {"phase": "executing"}
                ))
                # 调用 Async core function
                final_result = await perform_seat_operation(
                    mode, cookie, lib_id, seat_key, start_dt,
                    globals.ROOM_ID_TO_NAME, globals.SEAT_MAPPINGS,
                    ws_status_callback_sync, client_id,
                    api_url, origin, referer
                )
                break
            
            # 4. 智能等待 (Smart Wait)
            if remaining_seconds > 30:
                # 距离还远，沉睡较久，每30秒发送一次心跳
                if int(remaining_seconds) % 30 == 0:
                    minutes = int(remaining_seconds) // 60
                    secs = int(remaining_seconds) % 60
                    if minutes > 0:
                        time_str = f"{minutes}分{secs}秒"
                    else:
                        time_str = f"{secs}秒"
                    await send_status(create_status_message(
                        "countdown",
                        f"等待中，还有 {time_str}",
                        {"remaining": int(remaining_seconds), "phase": "waiting"}
                    ))
                await asyncio.sleep(1) 
            elif remaining_seconds > 10:
                await asyncio.sleep(0.5)
            else:
                # 最后10秒倒计时 (带状态跟踪)
                if 'last_logged_sec' not in locals():
                     last_logged_sec = -999

                if display_sec != last_logged_sec and display_sec >= 0:
                     await send_status(create_status_message(
                         "countdown",
                         f"倒计时 {display_sec} 秒",
                         {"remaining": display_sec, "phase": "countdown"}
                     ))
                     last_logged_sec = display_sec
                
                # 高精度等待
                wait_time = max(0.01, min(0.05, remaining_seconds / 5))
                await asyncio.sleep(wait_time)
                
    else:
        # 立即执行
        final_result = await perform_seat_operation(
            mode, cookie, lib_id, seat_key, start_dt,
            globals.ROOM_ID_TO_NAME, globals.SEAT_MAPPINGS,
            ws_status_callback_sync, client_id,
            api_url, origin, referer
        )

    # --- 后续处理 ---
    logger.info(f"[后台任务 {client_id}] 执行完毕，结果: {final_result}")

    status_code_ws = "success" if "成功" in final_result else "error"
    if "任务已被用户取消" in final_result:
        status_code_ws = "cancelled"
    
    error_code_ws = SEAT_TAKEN_ERROR_CODE if final_result == SEAT_TAKEN_ERROR_CODE else None
    
    if manager:
        await manager.send_final_result(client_id, status_code_ws, final_result, error_code_ws)