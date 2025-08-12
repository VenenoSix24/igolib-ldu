# -*- coding: utf-8 -*-
"""
数据处理模块

负责加载和处理所有外部数据，例如阅览室和座位的映射文件。
"""
import os
import json
import glob
from typing import Dict, Tuple

# 从配置模块导入所需的文件路径和全局变量定义
from config import ROOM_MAPPINGS_FILE, SEAT_MAPPINGS_DIR

def load_mappings() -> Tuple[bool, Dict[str, str], Dict[str, str], Dict[str, Dict[str, str]]]:
    """
    从JSON文件中加载阅览室和座位映射。

    Returns:
        A tuple containing:
        - bool: True 表示加载成功, False 表示失败。
        - Dict[str, str]: ROOM_ID_TO_NAME 映射。
        - Dict[str, str]: ROOM_NAME_TO_ID 映射。
        - Dict[str, Dict[str, str]]: SEAT_MAPPINGS 映射。
    """
    print("正在加载阅览室和座位映射数据...")
    room_id_to_name: Dict[str, str] = {}
    seat_mappings: Dict[str, Dict[str, str]] = {}

    try:
        if not os.path.exists(ROOM_MAPPINGS_FILE):
            print(f"错误: 阅览室映射文件未找到: {ROOM_MAPPINGS_FILE}")
            return False, {}, {}, {}
        with open(ROOM_MAPPINGS_FILE, 'r', encoding='utf-8') as f:
            room_id_to_name = json.load(f)
        
        room_name_to_id = {v: k for k, v in room_id_to_name.items()}
        print(f"成功加载 {len(room_id_to_name)} 个阅览室映射。")

        seat_files = glob.glob(os.path.join(SEAT_MAPPINGS_DIR, '*.json'))
        if not seat_files:
             print(f"警告: 在 {SEAT_MAPPINGS_DIR} 未找到座位映射文件 (*.json)。")
        else:
            loaded_seat_maps = 0
            for seat_file in seat_files:
                try:
                    room_name_from_file = os.path.splitext(os.path.basename(seat_file))[0]
                    if room_name_from_file in room_name_to_id:
                        with open(seat_file, 'r', encoding='utf-8') as f:
                            seat_map = json.load(f)
                            if isinstance(seat_map, dict):
                                seat_mappings[room_name_from_file] = seat_map
                                loaded_seat_maps += 1
                            else:
                                print(f"警告: 座位文件 '{os.path.basename(seat_file)}' 内容格式不正确，已跳过。")
                    else:
                        print(f"警告: 座位文件 '{os.path.basename(seat_file)}' 对应的阅览室 '{room_name_from_file}' 未找到，已跳过。")
                except Exception as e:
                    print(f"加载座位文件 {seat_file} 时发生错误: {e}")
            if loaded_seat_maps > 0:
                print(f"成功加载 {loaded_seat_maps} 个阅览室的座位映射。")

        if not room_id_to_name:
            print("错误: 未能加载任何阅览室数据。")
            return False, {}, {}, {}
            
        return True, room_id_to_name, room_name_to_id, seat_mappings

    except Exception as e:
        print(f"加载映射数据时发生严重错误: {type(e).__name__} - {e}")
        return False, {}, {}, {}