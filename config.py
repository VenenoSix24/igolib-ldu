# -*- coding: utf-8 -*-
"""
配置模块

存放项目所有的全局变量、常量、API地址、文件路径以及请求模板。
"""
import os
import datetime

# --- 核心API与WebSocket地址 ---
URL = 'https://libseats.ldu.edu.cn/index.php/graphql/'
WEBSOCKET_URL = 'wss://libseats.ldu.edu.cn/ws?ns=prereserve/queue'

# --- 预约逻辑相关配置 ---
MAX_REQUEST_ATTEMPTS = 3
SLEEP_INTERVAL_ON_FAIL = 0.5
COOKIE_ERROR_PATTERN = r'Connection to remote host was lost|invalid session|请先登录|登陆|验证失败'
SEAT_TAKEN_ERROR_CODE = "SEAT_TAKEN"

# --- 时间窗口与默认时间 ---
TOMORROW_RESERVE_WINDOW_START = datetime.time(0, 0, 0)
TOMORROW_RESERVE_WINDOW_END = datetime.time(23, 59, 59)
DEFAULT_RESERVE_TIME_STR = "21:48:00"

# --- 文件与路径配置 ---
try:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    SCRIPT_DIR = os.getcwd()

DATA_DIR = os.path.join(SCRIPT_DIR, 'data_process')
ROOM_MAPPINGS_FILE = os.path.join(DATA_DIR, 'room', 'output', 'room_mappings.json')
SEAT_MAPPINGS_DIR = os.path.join(DATA_DIR, 'seat', 'output')
COOKIE_FILENAME = "latest_cookie.txt"
COOKIE_FILE_PATH = os.path.join(SCRIPT_DIR, COOKIE_FILENAME)
FILE_CHECK_INTERVAL = 2
MAX_WAIT_TIME = 120

# --- 默认HTTP请求头模板 ---
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/13603 Flue'

queue_header_base: dict[str, str] = {
    'Host': 'libseats.ldu.edu.cn',
    'Connection': 'Upgrade',
    'Pragma': 'no-cache', 
    'Cache-Control': 'no-cache',
    'User-Agent': USER_AGENT,
    'Upgrade': 'websocket',
    'Origin': 'https://libseats.ldu.edu.cn',
    'Sec-WebSocket-Version': '13',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Cookie': ''
}

pre_header_base: dict[str, str] = {
    'Host': 'libseats.ldu.edu.cn',
    'Connection': 'keep-alive',
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': 'https://libseats.ldu.edu.cn',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Referer': 'https://libseats.ldu.edu.cn/web/index.html',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Cookie': ''
}

# --- GraphQL 查询语句与数据模板 ---
_tomorrow_query = """
mutation save($key: String!, $libid: Int!, $captchaCode: String, $captcha: String) {
  userAuth { prereserve { save(key: $key, libId: $libid, captcha: $captcha, captchaCode: $captchaCode) } }
}
"""
data_template_tomorrow: dict[str, any] = {
    "operationName": "save", "variables": {"key": "", "libid": 0, "captchaCode": "", "captcha": ""},
    "query": _tomorrow_query.strip()
}

_today_query = """
mutation reserveSeat($libId: Int!, $seatKey: String!, $captchaCode: String, $captcha: String!) {
  userAuth { reserve { reserveSeat(libId: $libId, seatKey: $seatKey, captchaCode: $captchaCode, captcha: $captcha) } }
}
"""
data_template_today: dict[str, any] = {
    "operationName": "reserveSeat", "variables": {"seatKey": "", "libId": 0, "captchaCode": "", "captcha": ""},
    "query": _today_query.strip()
}

_validate_query = """
query prereserve { userAuth { prereserve { prereserve { day lib_id seat_key seat_name is_used user_mobile id lib_name } } } }
"""
data_validate: dict[str, any] = {"operationName": "prereserve", "query": _validate_query.strip()}

_layout_query = """
query libLayout($libId: Int!) { userAuth { prereserve { libLayout(libId: $libId) { max_x max_y seats_booking seats_total seats_used seats { key name seat_status status type x y } } } } }
"""
data_lib_chosen_template: dict[str, any] = {
    "operationName": "libLayout", "variables": {"libId": 0},
    "query": _layout_query.strip()
}

# --- 动态数据获取查询模板 ---
# 阶段一：获取所有场馆列表（包含剩余座位数）
_rooms_list_query = """
query list {
    userAuth {
        reserve {
            libs(libType: -1) {
                lib_id
                lib_name
                lib_floor
                is_open
                lib_rt {
                    seats_total
                    seats_used
                    seats_has
                    open_time_str
                    close_time_str
                }
            }
        }
    }
}
"""
data_rooms_list_template: dict[str, any] = {
    "operationName": "list",
    "query": _rooms_list_query.strip(),
    "variables": {}
}

# 阶段二：获取指定场馆的座位布局
_seats_layout_query = """
query libLayout($libId: Int, $libType: Int) {
    userAuth {
        reserve {
            libs(libType: $libType, libId: $libId) {
                lib_id
                lib_name
                lib_layout {
                    seats_total
                    seats_used
                    seats {
                        x
                        y
                        key
                        type
                        name
                        seat_status
                        status
                    }
                }
            }
        }
    }
}
"""
data_seats_layout_template: dict[str, any] = {
    "operationName": "libLayout",
    "query": _seats_layout_query.strip(),
    "variables": {"libId": 0, "libType": -1}
}