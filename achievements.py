# achievements.py (Async Refactor + Fake Stats)

"""
成就/统计系统逻辑模块

负责处理所有与全站统计数据（读取、更新、保存）相关的操作。
包含“虚拟统计数据”功能，用于让界面看起来更活跃。
"""
import json
import os
import logging
import asyncio
import random
from datetime import date
from collections import Counter
import aiofiles

# 获取一个以当前模块名命名的logger
logger = logging.getLogger(__name__)

STATS_FILE_PATH = os.path.join(os.path.dirname(__file__), 'app_data', 'achievements.json')
_lock = asyncio.Lock()

# --- 虚拟数据配置 ---
# 如果开启，将返回大额随机数据
ENABLE_FAKE_STATS = True 

def _get_initial_data():
    """返回初始数据"""
    return {
        "totalReservations": 0,
        "dailyReservations": {},
        "roomUsage": {}
    }

def _get_fake_stats():
    """生成好看的假数据"""
    today_str = date.today().isoformat()
    # 随机生成一个"今日"基数，基于小时变化，早上少晚上多？或者固定一个大数
    # 假设今日已经有 500+ 人
    fake_today = 520 + random.randint(0, 50) 
    fake_total = 12580 + random.randint(0, 100)
    
    # 随机选一个阅览室
    rooms = ["601研讨空间", "602自习室", "501借阅室", "404静读区", "一楼大厅"]
    fake_room = random.choice(rooms)
    
    return {
        "todayReservations": fake_today,
        "totalReservations": fake_total,
        "favoriteRoom": fake_room
    }

async def get_stats_data() -> dict:
    """内部使用的获取完整数据"""
    async with _lock:
        if not os.path.exists(STATS_FILE_PATH):
            return _get_initial_data()
        try:
            async with aiofiles.open(STATS_FILE_PATH, 'r', encoding='utf-8') as f:
                content = await f.read()
                if not content: return _get_initial_data()
                return json.loads(content)
        except Exception:
            return _get_initial_data()

async def update_stats_on_success(room_name: str):
    """
    当一次预约成功后，更新并保存统计数据。
    即使使用假数据展示，这里仍然记录真实数据，以备后用。
    """
    async with _lock:
        stats = _get_initial_data()
        if os.path.exists(STATS_FILE_PATH):
            try:
                async with aiofiles.open(STATS_FILE_PATH, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    if content: stats = json.loads(content)
            except Exception: pass

        stats["totalReservations"] = stats.get("totalReservations", 0) + 1
        today_str = date.today().isoformat()
        daily_counts = stats.get("dailyReservations", {})
        daily_counts[today_str] = daily_counts.get(today_str, 0) + 1
        stats["dailyReservations"] = daily_counts

        room_usage = stats.get("roomUsage", {})
        room_usage[room_name] = room_usage.get(room_name, 0) + 1
        stats["roomUsage"] = room_usage

        try:
            async with aiofiles.open(STATS_FILE_PATH, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(stats, ensure_ascii=False, indent=4))
        except Exception as e:
            logger.error(f"保存统计文件时发生错误: {e}")

async def get_formatted_stats() -> dict:
    """
    获取格式化数据。如果启用 Fake Stats，则返回假数据，
    但也加上真实的增量（可选，为了简单起见，这里直接返回假数据）。
    """
    if ENABLE_FAKE_STATS:
        # 为了让数字在此时刻看起来稳定（不要每次刷新都变），可以基于时间种子或者读取真实数据+Offset
        # 这里简单起见，返回一个相对稳定的假数据
        return _get_fake_stats()

    # 真实逻辑
    stats = await get_stats_data()
    today_str = date.today().isoformat()
    room_usage = stats.get("roomUsage", {})
    if not room_usage:
        favorite_room = "暂无"
    else:
        favorite_room = Counter(room_usage).most_common(1)[0][0]

    return {
        "todayReservations": stats.get("dailyReservations", {}).get(today_str, 0),
        "totalReservations": stats.get("totalReservations", 0),
        "favoriteRoom": favorite_room
    }