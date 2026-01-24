# globals.py

"""
全局状态模块

存放需要跨模块共享的全局变量。
"""
from typing import Dict

# 用于缓存从文件中加载的映射数据。
ROOM_ID_TO_NAME: Dict[str, str] = {}
ROOM_NAME_TO_ID: Dict[str, str] = {}
SEAT_MAPPINGS: Dict[str, Dict[str, str]] = {}