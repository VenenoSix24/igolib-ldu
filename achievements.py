# achievements.py

"""
成就/统计系统逻辑模块

负责处理所有与全站统计数据（读取、更新、保存）相关的操作。
"""
import json
import os
import logging
from datetime import date
from threading import Lock
from collections import Counter

# 获取一个以当前模块名命名的logger
logger = logging.getLogger(__name__)

STATS_FILE_PATH = os.path.join(os.path.dirname(__file__), 'app_data', 'achievements.json')

# 创建一个线程锁。
# 防止当多个用户同时预约成功时，程序同时写入文件导致数据错乱或损坏。
_lock = Lock()

def _get_initial_data():
    """返回一个标准的、初始化的空数据结构，用于处理文件不存在或为空的情况"""
    return {
        "totalReservations": 0,
        "dailyReservations": {},
        "roomUsage": {}
    }

def get_stats_data() -> dict:
    """
    安全地从 JSON 文件读取统计数据。
    使用了线程锁来保证读取操作的原子性。
    """
    with _lock:
        if not os.path.exists(STATS_FILE_PATH):
            logger.warning(f"统计文件未找到，将使用初始数据: {STATS_FILE_PATH}")
            return _get_initial_data()
        try:
            with open(STATS_FILE_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
                if not content:
                    logger.warning("统计文件为空，将使用初始数据。")
                    return _get_initial_data()
                return json.loads(content)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"读取统计文件时出错: {e}, 将返回初始数据。")
            return _get_initial_data()

def update_stats_on_success(room_name: str):
    """
    当一次预约成功后，更新并保存统计数据。
    这是整个模块的核心“写入”操作。
    """
    with _lock:
        logger.info(f"准备更新统计数据：成功预约阅览室 '{room_name}'")
        stats = get_stats_data() # 读取当前最新的数据

        # 1. 更新累计成功总数
        stats["totalReservations"] = stats.get("totalReservations", 0) + 1

        # 2. 更新今日成功次数
        today_str = date.today().isoformat() # 获取 "YYYY-MM-DD" 格式的今天日期
        daily_counts = stats.get("dailyReservations", {})
        daily_counts[today_str] = daily_counts.get(today_str, 0) + 1
        stats["dailyReservations"] = daily_counts

        # 3. 更新阅览室使用次数
        room_usage = stats.get("roomUsage", {})
        room_usage[room_name] = room_usage.get(room_name, 0) + 1
        stats["roomUsage"] = room_usage

        # 4. 将更新后的数据完整地写回文件
        try:
            with open(STATS_FILE_PATH, 'w', encoding='utf-8') as f:
                json.dump(stats, f, ensure_ascii=False, indent=4)
            logger.info("统计数据更新并保存成功。")
        except Exception as e:
            logger.error(f"保存统计文件时发生严重错误: {e}", exc_info=True)

def get_formatted_stats() -> dict:
    """
    获取一个格式化后的、可以直接被前端API使用的数据字典。
    这是一个“读取”操作，用于展示。
    """
    stats = get_stats_data()
    today_str = date.today().isoformat()

    # 计算最受欢迎的阅览室
    room_usage = stats.get("roomUsage", {})
    if not room_usage:
        favorite_room = "暂无"
    else:
        # 使用 Counter 可以非常高效地找到次数最多的项
        favorite_room = Counter(room_usage).most_common(1)[0][0]

    # 组装成前端需要的格式
    return {
        "todayReservations": stats.get("dailyReservations", {}).get(today_str, 0),
        "totalReservations": stats.get("totalReservations", 0),
        "favoriteRoom": favorite_room
    }