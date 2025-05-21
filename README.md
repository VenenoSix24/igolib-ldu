# 我去抢个座 - Web (igolib_ldu_web)

![版本](https://img.shields.io/badge/版本-3.0.5-blue.svg)
![Python](https://img.shields.io/badge/Python-3.9+-green.svg)
![许可证](https://img.shields.io/badge/许可证-MIT-yellow.svg)

一个用于鲁东大学图书馆座位预约和抢座的自动化工具。通过 Web 界面操作，轻松实现图书馆座位预约。

## ✨ 功能特性

- 🔄 **明日预约模式**：在开放时间预约第二天的座位
- ⚡ **即时抢座模式**：实时抢占当天可用座位
- 🌐 **Web 界面**：友好的用户操作界面，无需编程知识
- 🕒 **定时执行**：设置精确时间自动执行抢座操作
- 🗺️ **座位映射**：直观的阅览室和座位号映射

## 📋 目录

- [安装指南](#-安装指南)
- [使用方法](#-使用方法)
  - [Web 界面](#web界面)
- [配置说明](#-配置说明)
- [屏幕截图](#-屏幕截图)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)

## 📦 安装指南

### 环境要求

- Python 3.9+
- pip 包管理器

### 安装步骤

1. **克隆或下载项目代码**

```bash
git clone https://github.com/VenenoSix24/igolib-ldu.git
cd igolib-ldu
```

2. **创建并激活虚拟环境**（推荐）

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

3. **安装依赖包**

```bash
pip install -r requirements.txt
```

## 🚀 使用方法

### Web 界面

1. **启动 Web 服务**

```bash
uvicorn beta:app --reload --host 0.0.0.0 --port 8000
```

2. **访问 Web 界面**

打开浏览器访问: `http://127.0.0.1:8000`

3. **使用流程**
   - 设置 Cookie 获取
   - 选择阅览室和座位
   - 设置预约/抢座模式和执行时间
   - 提交并等待结果

## ⚙️ 配置说明

系统主要配置位于 `beta.py`文件顶部，主要配置项包括：

- `URL`和 `WEBSOCKET_URL`: 服务器接口地址
- `TOMORROW_RESERVE_WINDOW_START`/`END`: 预约时间窗口
- `DEFAULT_RESERVE_TIME_STR`: 默认预约执行时间
- `COOKIE_FILENAME`: Cookie 文件保存路径

座位和阅览室数据存储在 `data_process`目录下：

- 阅览室映射: `data_process/room/output/room_mappings.json`
- 座位映射: `data_process/seat/output/{room_name}.json`

## 📸 屏幕截图

> 占个坑

## 🤝 贡献指南

欢迎提交问题报告和功能请求！如果您想贡献代码：

1. Fork 这个仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 📄 许可证

该项目采用 MIT 许可证 - 详情请参阅 LICENSE 文件
