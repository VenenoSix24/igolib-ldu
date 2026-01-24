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
import pytz
from typing import Optional

from core import perform_seat_operation
from config import SEAT_TAKEN_ERROR_CODE
import globals

logger = logging.getLogger(__name__)

# 定义北京时区
BEIJING_TZ = pytz.timezone('Asia/Shanghai')

async def background_task_runner(
    client_id: str,
    mode: int,
    cookie: str,
    lib_id: int,
    seat_key: str,
    start_dt: Optional[datetime.datetime]
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
        # 立即发送一条状态，避免用户等待
        remaining_seconds = start_dt.timestamp() - now_dt.timestamp()
        await send_status(f"预约任务已启动，距离计划执行时间还有 {remaining_seconds:.1f} 秒...")
        
        while True:
            # 1. 检查任务取消
            if manager.is_task_cancelled(client_id):
                await send_status("❌ 任务已被用户取消")
                manager.clear_cancelled_task(client_id)
                final_result = "任务已被用户取消"
                break
            
            # 2. 计算剩余时间
            now_ts = time.time()
            remaining_seconds = start_dt.timestamp() - now_ts
            
            # 移除偏移量，严格与前端 Math.floor 保持一致，确保精确同步
            display_sec = int(remaining_seconds)
            
            # 3. 触发条件
            if remaining_seconds <= 0.01:
                await send_status("\n时间到，开始执行！")
                # 调用 Async core function
                final_result = await perform_seat_operation(
                    mode, cookie, lib_id, seat_key, start_dt,
                    globals.ROOM_ID_TO_NAME, globals.SEAT_MAPPINGS,
                    ws_status_callback_sync, client_id
                )
                break
            
            # 4. 智能等待 (Smart Wait)
            # 使用 asyncio.sleep 释放控制权
            if remaining_seconds > 30:
                # 距离还远，沉睡较久，但需定期醒来检查取消状态
                if int(remaining_seconds) % 30 == 0:
                    await send_status(f"任务挂起中，剩余 {int(remaining_seconds)} 秒...")
                await asyncio.sleep(1) 
            elif remaining_seconds > 10:
                await asyncio.sleep(0.5)
            else:
                # 倒计时显示逻辑 (带状态跟踪)
                if 'last_logged_sec' not in locals():
                     last_logged_sec = -999

                if display_sec != last_logged_sec and display_sec >= 0:
                     await send_status(f"距离计划执行时间还有 {display_sec} 秒...")
                     last_logged_sec = display_sec
                
                # 高精度等待
                wait_time = max(0.01, min(0.05, remaining_seconds / 5))
                await asyncio.sleep(wait_time)
                
    else:
        # 立即执行
        final_result = await perform_seat_operation(
            mode, cookie, lib_id, seat_key, start_dt,
            globals.ROOM_ID_TO_NAME, globals.SEAT_MAPPINGS,
            ws_status_callback_sync, client_id
        )

    # --- 后续处理 ---
    logger.info(f"[后台任务 {client_id}] 执行完毕，结果: {final_result}")

    status_code_ws = "success" if "成功" in final_result else "error"
    if "任务已被用户取消" in final_result:
        status_code_ws = "cancelled"
    
    error_code_ws = SEAT_TAKEN_ERROR_CODE if final_result == SEAT_TAKEN_ERROR_CODE else None
    
    if manager:
        await manager.send_final_result(client_id, status_code_ws, final_result, error_code_ws)