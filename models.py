# models.py
"""
Pydantic 数据模型模块

定义所有用于 API 请求体验证和数据交换的数据模型。
"""
from pydantic import BaseModel, Field, validator

# 从 core 模块导入验证函数
from core import calculate_execution_dt, validate_time_format

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
        if 'mode' in values:
            mode = values['mode']
            time_str = v.strip()
            
            if mode == 1: # 明日预约模式
                if not time_str:
                    raise ValueError('明日预约模式必须提供执行时间')
                if time_str == "00:00:01":
                    return time_str
                if not validate_time_format(time_str):
                    raise ValueError('时间格式错误，应为 HH:MM:SS')
                if calculate_execution_dt(time_str, check_window=True) is None:
                    raise ValueError(f"预约时间 '{time_str}' 无效或不在窗口内/已过")
            
            elif mode == 2 and time_str: # 立即抢座模式
                if not validate_time_format(time_str):
                    raise ValueError('时间格式错误，应为 HH:MM:SS')
                if calculate_execution_dt(time_str, check_window=False) is None:
                    raise ValueError(f"抢座时间 '{time_str}' 无效或已过")
                    
        return v