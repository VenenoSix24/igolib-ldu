# -*- coding: utf-8 -*-
"""
Web 应用模块

包含所有与 FastAPI 和 Web 界面相关的代码，包括API端点、WebSocket管理和 Pydantic 模型。
"""
import asyncio
from typing import Dict, Optional, Set

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
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, validator

# 从项目其他模块导入必要的函数和变量
from config import TEMPLATES_DIR, SEAT_TAKEN_ERROR_CODE
from core import calculate_execution_dt, validate_time_format

# --- FastAPI 应用实例和模板引擎 ---
app = FastAPI(title="我去抢个座", description="用于预约或抢座图书馆座位")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# --- WebSocket 连接管理器 ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.message_locks: Dict[str, asyncio.Lock] = {}
        self.cancelled_tasks: Set[str] = set()

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.message_locks[client_id] = asyncio.Lock()
        print(f"WebSocket connected: {client_id}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.message_locks:
            del self.message_locks[client_id]
        print(f"WebSocket disconnected: {client_id}")

    async def _send_json_safe(self, client_id: str, payload: dict):
        websocket = self.active_connections.get(client_id)
        lock = self.message_locks.get(client_id)
        if websocket and lock:
            async with lock:
                try:
                    await websocket.send_json(payload)
                    await asyncio.sleep(0.01)
                except Exception as e:
                    print(f"发送 WS 消息至 {client_id} 出错: {e}")
                    self.disconnect(client_id)

    async def send_status_update(self, client_id: str, message: str):
        await self._send_json_safe(client_id, {"type": "status", "message": message})

    async def send_final_result(self, client_id: str, status: str, message: str, error_code: Optional[str] = None):
        payload = {"type": "result", "status": status, "message": message}
        if error_code:
            payload["error_code"] = error_code
        await self._send_json_safe(client_id, payload)

    def cancel_task(self, client_id: str):
        self.cancelled_tasks.add(client_id)
        print(f"任务 (Client: {client_id}) 已被标记为取消")

    def is_task_cancelled(self, client_id: str) -> bool:
        return client_id in self.cancelled_tasks

    def clear_cancelled_task(self, client_id: str):
        if client_id in self.cancelled_tasks:
            self.cancelled_tasks.remove(client_id)

manager = ConnectionManager()

# --- Pydantic 数据模型 ---
class SeatRequestWeb(BaseModel):
    mode: int = Field(..., description="操作模式: 1-明日预约, 2-立即抢座")
    cookieStr: str = Field(..., description="用户 Cookie")
    timeStr: str = Field("", description="执行时间 (HH:MM:SS)")
    libId: int = Field(..., description="阅览室 ID")
    seatNumber: str = Field(..., description="用户输入的座位号")
    clientId: str = Field(..., description="WebSocket 客户端 ID")

    @validator('mode')
    def mode_must_be_1_or_2(cls, v):
        if v not in [1, 2]:
            raise ValueError('模式必须是 1 (明日预约) 或 2 (立即抢座)')
        return v

    @validator('timeStr')
    def validate_time_web(cls, v, values):
        # `values` 包含了已验证过的其他字段
        if 'mode' in values:
            mode = values['mode']
            time_str = v.strip()
            
            if mode == 1: # 明日预约模式
                if not time_str:
                    raise ValueError('明日预约模式必须提供执行时间')
                if time_str == "00:00:01": # 特殊值，表示立即执行
                    return time_str
                if not validate_time_format(time_str):
                    raise ValueError('时间格式错误，应为 HH:MM:SS')
                if calculate_execution_dt(time_str, check_window=True) is None:
                    raise ValueError(f"预约时间 '{time_str}' 无效或不在窗口内/已过")
            
            elif mode == 2 and time_str: # 立即抢座模式（但提供了时间）
                if not validate_time_format(time_str):
                    raise ValueError('时间格式错误，应为 HH:MM:SS')
                if calculate_execution_dt(time_str, check_window=False) is None:
                    raise ValueError(f"抢座时间 '{time_str}' 无效或已过")
                    
        return v

# --- API 端点 ---

from tasks import background_task_runner

@app.get("/api/mappings")
async def get_mappings(request: Request):
    from tasks import ROOM_ID_TO_NAME, SEAT_MAPPINGS, load_and_get_mappings
    
    id_to_name, _, _ = load_and_get_mappings()
    sorted_rooms = dict(sorted(id_to_name.items(), key=lambda item: item[1]))
    return {"rooms": sorted_rooms}

@app.post("/api/submit_request")
async def handle_seat_request(request: SeatRequestWeb, background_tasks: BackgroundTasks):
    from tasks import ROOM_ID_TO_NAME, SEAT_MAPPINGS, load_and_get_mappings

    print(f"\n收到 Web 请求: Client={request.clientId}, Mode={request.mode}, LibID={request.libId}, SeatNo='{request.seatNumber}', Time='{request.timeStr}'")
    
    # 确保映射已加载
    _, name_to_id, seat_mappings = load_and_get_mappings()
    
    lib_id_str = str(request.libId)
    room_name = ROOM_ID_TO_NAME.get(lib_id_str)
    if not room_name:
        raise HTTPException(status_code=404, detail=f"无效阅览室 ID ({request.libId})")

    seat_map_for_room = seat_mappings.get(room_name)
    if not seat_map_for_room:
        raise HTTPException(status_code=404, detail=f"未找到阅览室 '{room_name}' 的座位图")

    seat_key = seat_map_for_room.get(request.seatNumber.strip())
    if not seat_key:
        raise HTTPException(status_code=404, detail=f"在 '{room_name}' 中未找到座位号 '{request.seatNumber.strip()}'")

    print(f"查找成功: Room='{room_name}', SeatNo='{request.seatNumber.strip()}' -> Key='{seat_key}'")
    
    start_action_dt = None
    if request.timeStr:
        start_action_dt = calculate_execution_dt(request.timeStr, check_window=(request.mode == 1))
        if start_action_dt is None:
            raise HTTPException(status_code=400, detail="执行时间无效或已过")

    # 添加后台任务
    background_tasks.add_task(
        background_task_runner,
        client_id=request.clientId,
        mode=request.mode,
        cookie=request.cookieStr,
        lib_id=request.libId,
        seat_key=seat_key,
        start_dt=start_action_dt
    )

    print(f"任务已添加: Client={request.clientId}, Key={seat_key}")
    return JSONResponse(content={"status": "processing", "message": "请求已提交后台处理，请通过 WebSocket 查看状态。"})

@app.post("/api/cancel_task/{client_id}")
async def cancel_task(client_id: str):
    print(f"收到取消任务请求: Client={client_id}")
    if client_id not in manager.active_connections:
        raise HTTPException(status_code=404, detail="客户端 WebSocket 未连接")
    manager.cancel_task(client_id)
    await manager.send_status_update(client_id, "任务取消请求已接收，正在处理...")
    return JSONResponse(content={"status": "cancelling", "message": "任务取消请求已接收"})

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            await websocket.receive_text()  # 保持连接
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WS 错误 for {client_id}: {e}")
        manager.disconnect(client_id)

@app.websocket("/ws_test_connection")
async def websocket_test_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.close(code=1000)

# --- HTML 页面路由 ---
@app.get("/")
async def get_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/{page_name}.html")
async def get_page(request: Request, page_name: str):
    # 动态匹配所有 html 页面
    template_name = f"{page_name}.html"
    return templates.TemplateResponse(template_name, {"request": request})