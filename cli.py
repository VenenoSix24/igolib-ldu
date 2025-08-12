# -*- coding: utf-8 -*-
"""
命令行界面 (CLI) 模块

负责处理所有命令行交互的逻辑。
"""
import os
import stat
import time
import datetime
import subprocess
from typing import Optional

# 从项目其他模块导入必要的函数和变量
from config import (
    COOKIE_FILE_PATH, SCRIPT_DIR, MITMPROXY_COMMAND,
    MITMPROXY_SCRIPT_NAME, MAX_WAIT_TIME, FILE_CHECK_INTERVAL,
    TOMORROW_RESERVE_WINDOW_START, TOMORROW_RESERVE_WINDOW_END
)
from core import perform_seat_operation, calculate_execution_dt, validate_time_format
from data_utils import load_mappings

# 这个全局变量用于在此模块内部跟踪 mitmproxy 进程
mitmproxy_process = None

def start_mitmproxy():
    """启动 mitmproxy 脚本作为后台进程 (CLI专用)"""
    global mitmproxy_process
    MITMPROXY_SCRIPT_PATH = os.path.join(SCRIPT_DIR, MITMPROXY_SCRIPT_NAME)
    if mitmproxy_process and mitmproxy_process.poll() is None:
        print("Mitmproxy 进程似乎已在运行。")
        return True
    if not os.path.exists(MITMPROXY_SCRIPT_PATH):
        print(f"错误：mitmproxy 脚本未找到: {MITMPROXY_SCRIPT_PATH}")
        return False
    command = [MITMPROXY_COMMAND, "-s", MITMPROXY_SCRIPT_PATH, "--set", "web_port=8081"]
    try:
        print(f"正在启动 mitmproxy ({MITMPROXY_COMMAND}) 后台进程...")
        mitmproxy_process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        print(f"Mitmproxy 进程已启动 (PID: {mitmproxy_process.pid})。")
        return True
    except Exception as e:
        print(f"启动 mitmproxy 时发生错误: {e}")
        return False

def stop_mitmproxy():
    """停止由本程序启动的 mitmproxy 进程 (CLI专用)"""
    global mitmproxy_process
    if mitmproxy_process and mitmproxy_process.poll() is None:
        print(f"正在尝试终止 mitmproxy 进程 (PID: {mitmproxy_process.pid})...")
        try:
            mitmproxy_process.terminate()
            mitmproxy_process.wait(timeout=5)
            print("Mitmproxy 进程已终止。")
        except Exception as e:
            print(f"终止 mitmproxy 进程时发生错误: {e}")
        finally:
             mitmproxy_process = None
             

def auto_get_cookie_cli() -> Optional[str]:
    """
    启动 mitmproxy(如果未运行)，指导用户操作，并监控文件。
    返回 Cookie 字符串或 None。
    """
    if not start_mitmproxy():
        print("无法启动 mitmproxy，自动获取 Cookie 失败。")
        return None

    print("\n请按以下步骤操作：")
    print(f"  1. Mitmproxy 应该已在后台启动。")
    if MITMPROXY_COMMAND == "mitmweb":
         print("     (可在 http://127.0.0.1:8081 查看流量)")
    print(f"  2. 【重要】请现在手动设置系统网络代理为: 127.0.0.1:8080")
    print(f"  3. 打开【电脑版微信】并访问【图书馆小程序首页】以触发 Cookie 更新。")
    print(f"  4. 程序将自动检测位于 '{SCRIPT_DIR}' 目录下的 '{os.path.basename(COOKIE_FILE_PATH)}' 文件更新。")

    input("\n完成代理设置和微信操作后，请按 Enter 键开始监控 Cookie 文件...")
    print("\n正在等待 Cookie 文件更新...")

    start_time = time.time()
    last_mtime = 0
    if os.path.exists(COOKIE_FILE_PATH):
        try:
            last_mtime = os.stat(COOKIE_FILE_PATH)[stat.ST_MTIME]
        except OSError:
            pass

    cookie_content = None
    while time.time() - start_time < MAX_WAIT_TIME:
        if os.path.exists(COOKIE_FILE_PATH):
            try:
                current_mtime = os.stat(COOKIE_FILE_PATH)[stat.ST_MTIME]
                if current_mtime > last_mtime:
                    print(f"\n检测到 '{os.path.basename(COOKIE_FILE_PATH)}' 文件更新！正在读取...")
                    time.sleep(0.5)
                    with open(COOKIE_FILE_PATH, "r", encoding='utf-8') as f:
                        cookie_content_read = f.read().strip()
                    if cookie_content_read and "=" in cookie_content_read:
                        print("Cookie 读取成功！")
                        cookie_content = cookie_content_read
                        break
                    else:
                        print("文件内容格式似乎不正确，继续等待...")
                        last_mtime = current_mtime
            except Exception as e:
                print(f"\n处理文件时发生意外错误: {e}")
                break

        print(".", end="", flush=True)
        time.sleep(FILE_CHECK_INTERVAL)

    if cookie_content:
         print("\n重要提示：现在可以取消系统网络代理设置了。")
         return cookie_content
    else:
        print("\n等待超时或读取失败。未能自动获取 Cookie。")
        return None

def run_cli():
    """运行命令行界面版本的工具。"""
    print("欢迎使用 图书馆抢座助手 (命令行版)")
    print("========================================")
    
    # 1. 加载数据
    success, room_id_to_name, room_name_to_id, seat_mappings = load_mappings()
    if not success:
        print("错误：加载映射失败，无法继续。")
        return

    # 2. 主循环
    while True:
        mode = 0
        while mode not in [1, 2]:
            try:
                mode_input = input("\n请选择操作模式 (1: 明日预约, 2: 立即抢座): ").strip()
                mode = int(mode_input)
            except ValueError:
                print("无效输入，请输入数字。")

        cookie_str = ""
        while not cookie_str:
            cookie_str = input("请输入完整的 Cookie (包含 Authorization=): ").strip()

        start_action_dt = None
        if mode == 1: # 明日预约
            while start_action_dt is None:
                time_str = input(f"请输入预约执行时间 (HH:MM:SS): ").strip()
                if validate_time_format(time_str):
                    start_action_dt = calculate_execution_dt(time_str, check_window=True)
        else: # 立即抢座
            time_str = input("请输入抢座执行时间 (HH:MM:SS, 留空则立即执行): ").strip()
            if not time_str:
                start_action_dt = datetime.datetime.now()
            elif validate_time_format(time_str):
                start_action_dt = calculate_execution_dt(time_str)

        print("\n请选择阅览室:")
        available_rooms = sorted(room_name_to_id.items())
        for i, (name, _) in enumerate(available_rooms):
            print(f"  {i + 1}: {name}")
        
        lib_id_int = 0
        chosen_room_name = ""
        while lib_id_int <= 0:
            try:
                choice = int(input(f"请输入阅览室序号 (1-{len(available_rooms)}): ").strip())
                if 1 <= choice <= len(available_rooms):
                    chosen_room_name, lib_id_str = available_rooms[choice - 1]
                    lib_id_int = int(lib_id_str)
            except (ValueError, IndexError):
                print("输入无效或超出范围。")

        seat_key = ""
        seat_map_for_room = seat_mappings.get(chosen_room_name)
        while not seat_key:
            seat_number_input = input(f"请输入 '{chosen_room_name}' 的座位号: ").strip()
            if seat_map_for_room:
                seat_key = seat_map_for_room.get(seat_number_input)
                if not seat_key:
                    print(f"错误: 在 '{chosen_room_name}' 未找到座位号 '{seat_number_input}'。")
            else: # 如果没有映射文件，则让用户直接输入key
                seat_key = seat_number_input

        # 执行核心操作
        final_result = perform_seat_operation(
            mode, cookie_str, lib_id_int, seat_key, start_action_dt,
            room_id_to_name, seat_mappings
        )

        print("\n--- 操作结束 ---")
        print(f"最终结果: {final_result}")
        
        try_again = input("\n是否要执行新的任务? (y/n): ").strip().lower()
        if try_again != 'y':
            break