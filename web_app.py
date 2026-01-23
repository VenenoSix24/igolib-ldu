# web_app.py
"""
Web 应用模块

包含所有与 FastAPI 和 Web 界面相关的代码，包括API端点、WebSocket管理和 Pydantic 模型。
"""
import asyncio
import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Optional, Set

from fastapi import (
    BackgroundTasks, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# --- 从模块中导入 ---
from core import calculate_execution_dt
from models import SeatRequestWeb
from tasks import background_task_runner
from data_utils import load_mappings
import globals

# 获取一个以当前模块名命名的logger
logger = logging.getLogger(__name__)

# --- 应用启动与关闭事件 ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("--- FastAPI 应用启动 ---")
    logger.info("正在初始化全局座位映射数据...")
    success, id_to_name, name_to_id, seat_maps = load_mappings()
    if success:
        globals.ROOM_ID_TO_NAME = id_to_name
        globals.ROOM_NAME_TO_ID = name_to_id
        globals.SEAT_MAPPINGS = seat_maps
        logger.info("✅ 全局数据初始化完成。")
    else:
        logger.critical("❌ 错误：全局数据初始化失败！应用可能无法正常工作。")
    yield
    logger.info("--- FastAPI 应用关闭 ---")

# --- FastAPI 应用实例 ---
app = FastAPI(title="我去抢个座 API", lifespan=lifespan)

# --- 静态文件挂载 ---
# 前端现在由 React 独立管理，后端不再挂载 static 目录，也不提供 favicon.ico
# 如果需要调试，可取消注释
# STATIC_DIR_PATH = os.path.join(os.path.dirname(__file__), "static")
# app.mount("/static", StaticFiles(directory=STATIC_DIR_PATH), name="static")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    捕获 Pydantic 校验错误，返回前端可读的 JSON 错误信息，
    防止前端显示 [object Object]
    """
    try:
        # 获取第一个错误信息
        error = exc.errors()[0]
        # 如果是 Pydantic 自定义错误 (ValueError)，msg 通常就是我们的错误提示
        msg = error.get("msg", "参数校验错误")
        # 去掉 'Value error, ' 前缀
        if msg.startswith("Value error, "):
            msg = msg.replace("Value error, ", "")
        
        return JSONResponse(
            status_code=400,
            content={"detail": f"{msg}"},
        )
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "请求参数无效"})

# --- WebSocket 管理器 ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.message_locks: Dict[str, asyncio.Lock] = {}
        self.cancelled_tasks: Set[str] = set()
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.message_locks[client_id] = asyncio.Lock()
        logger.info(f"WebSocket 已连接: {client_id}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections: del self.active_connections[client_id]
        if client_id in self.message_locks: del self.message_locks[client_id]
        logger.info(f"WebSocket 已断开: {client_id}")

    async def _send_json_safe(self, client_id: str, payload: dict):
        websocket = self.active_connections.get(client_id)
        lock = self.message_locks.get(client_id)
        if websocket and lock:
            async with lock:
                try:
                    await websocket.send_json(payload)
                except Exception as e:
                    logger.warning(f"发送 WS 消息至 {client_id} 出错: {e}")
                    self.disconnect(client_id)
    async def send_status_update(self, client_id: str, message: str):
        await self._send_json_safe(client_id, {"type": "status", "message": message})
    async def send_final_result(self, client_id: str, status: str, message: str, error_code: Optional[str] = None):
        payload = {"type": "result", "status": status, "message": message}
        if error_code: payload["error_code"] = error_code
        await self._send_json_safe(client_id, payload)
    def cancel_task(self, client_id: str):
        self.cancelled_tasks.add(client_id)
        logger.info(f"任务 (Client: {client_id}) 已被标记为取消")
    def is_task_cancelled(self, client_id: str) -> bool:
        return client_id in self.cancelled_tasks
    def clear_cancelled_task(self, client_id: str):
        if client_id in self.cancelled_tasks: self.cancelled_tasks.remove(client_id)
manager = ConnectionManager()


# --- API 端点 ---
@app.get("/api/mappings")
async def get_mappings():
    if not globals.ROOM_ID_TO_NAME:
        raise HTTPException(status_code=503, detail="服务正在初始化，请稍后重试。")
    sorted_rooms = dict(sorted(globals.ROOM_ID_TO_NAME.items(), key=lambda item: item[1]))
    return {"rooms": sorted_rooms}

@app.post("/api/submit_request")
async def handle_seat_request(request: SeatRequestWeb, background_tasks: BackgroundTasks):
    logger.info(f"收到 Web 请求: Client={request.clientId}, Mode={request.mode}, LibID={request.libId}, SeatNo='{request.seatNumber}'")
    room_name = globals.ROOM_ID_TO_NAME.get(str(request.libId))
    seat_map = globals.SEAT_MAPPINGS.get(room_name)
    if not room_name or not seat_map:
        raise HTTPException(status_code=404, detail="无效的阅览室ID。")
    seat_key = seat_map.get(request.seatNumber.strip())
    if not seat_key:
        raise HTTPException(status_code=404, detail=f"在 '{room_name}' 中未找到座位号 '{request.seatNumber.strip()}'")
    start_action_dt = None
    if request.timeStr:
        start_action_dt = calculate_execution_dt(request.timeStr, check_window=(request.mode == 1))
        if not start_action_dt:
            raise HTTPException(status_code=400, detail="执行时间无效或已过")
    background_tasks.add_task(
        background_task_runner,
        client_id=request.clientId, mode=request.mode, cookie=request.cookieStr,
        lib_id=request.libId, seat_key=seat_key, start_dt=start_action_dt
    )
    logger.info(f"任务已添加: Client={request.clientId}, Key={seat_key}")
    return JSONResponse(content={"status": "processing", "message": "请求已提交后台处理..."})

@app.post("/api/cancel_task/{client_id}")
async def cancel_task(client_id: str):
    logger.info(f"收到取消任务请求: Client={client_id}")
    if client_id not in manager.active_connections:
        raise HTTPException(status_code=404, detail="客户端 WebSocket 未连接")
    manager.cancel_task(client_id)
    await manager.send_status_update(client_id, "任务取消请求已接收，正在处理...")
    return JSONResponse(content={"status": "cancelling", "message": "任务取消请求已接收"})

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.warning(f"WS 错误 for {client_id}: {e}")
        manager.disconnect(client_id)

@app.websocket("/ws_test_connection")
async def websocket_test_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.debug("测试 WebSocket 连接已接受并立即关闭。")
    await websocket.close(code=1000)