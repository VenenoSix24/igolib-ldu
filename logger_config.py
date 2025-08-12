# logger_config.py

import logging
import sys
import os
from logging.handlers import TimedRotatingFileHandler

# --- 1. 定义日志格式 ---
CONSOLE_FORMATTER = logging.Formatter(
    fmt="%(asctime)s - %(levelname)-8s - %(message)s (%(filename)s:%(lineno)d)",
    datefmt="%H:%M:%S"
)
FILE_FORMATTER = logging.Formatter(
    fmt="%(asctime)s - %(levelname)-8s - %(name)-15s - %(message)s (%(filename)s:%(lineno)d)",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# --- 2. 创建 Handlers ---
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(CONSOLE_FORMATTER)
console_handler.setLevel(logging.INFO)

file_handler = TimedRotatingFileHandler(
    filename=os.path.join(log_dir, "app.log"),
    when="midnight",
    interval=1,
    backupCount=7,
    encoding="utf-8"
)
file_handler.setFormatter(FILE_FORMATTER)
file_handler.setLevel(logging.DEBUG)

# --- 3. 获取根 Logger 并应用配置 ---
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
# 防止重复添加 handler
if not logger.handlers:
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

# --- 4. 调整第三方库的日志级别 ---
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("websockets").setLevel(logging.WARNING)