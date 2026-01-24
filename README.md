# 我去抢个座 - iGoLib-LDU

![版本](https://img.shields.io/badge/版本-4.5.24-blue.svg)
![Python](https://img.shields.io/badge/Python-3.9+-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.12-brightgreen.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.17-38B2AC.svg)
![许可证](https://img.shields.io/badge/许可证-MIT-yellow.svg)


一个基于 **Python Asyncio + FastAPI + React** 的现代化图书馆座位预约系统。核心逻辑均为 **全异步 (Full Async)** 架构，采用 `httpx` 和 `websockets` 库，解决了线程阻塞问题，能够单线程高效处理海量并发抢座任务。支持明日预约和即时抢座两种模式，配合精美的响应式 Web 界面，提供极致流畅的体验。



![igolib_ldu_v4_p2.jpg](https://s2.loli.net/2026/01/24/vfFthcUYaTIDB9l.jpg)



*基于某个我去图书馆，谁去图书馆？！！*

**（人话：我想要抢一个喜欢的座位！！！！！！！拿来吧你）**

## 👀 悄悄话

**目前：**

* ~~只支持卤蛋大学~~ （v4.5.24 已实现）
* ~~只支持特定场馆（因为我经常用）~~ （v4.3.24 已实现）

**未来：**

* ~~增加选择他校配置~~ （v4.5.24 已实现）
* ~~自动获取场馆数据信息（现在的获取方法蠢蠢的）~~ （v4.3.24 已实现）

*咕咕咕...咕咕..*

## 📆 我的待办集

* [X] 重构拆分 beta.py 主程序，增强代码维护性
* [X] 动态获取场馆、座位信息
* [X] 多学校 API 配置支持
* [ ] Cookie 获取教程
* [x] 输入 Cookie 后，检验 Cookie 可用性
* [ ] 占座模式（感觉 Cookie 活不到 30 分钟）
* [ ] 取消预约座位（那岂不是还要先检测是否已有预约）
* [ ] 增加动态签到码显示选项
* [x] 多用户性能优化

## ✨ 功能特性

- 🚀 **全异步高性能内核**：基于 `asyncio`、`httpx` 和 `websockets` 重写核心逻辑，非阻塞 I/O，极低内存占用，秒级处理并发。
- 🔄 **明日预约模式**：在开放时间预约第二天的座位，支持 WebSocket 排队通道。
- ⚡ **即时抢座模式**：实时抢占当天可用座位，智能优化等待策略。
- 🌐 **精美Web界面**：基于 TailwindCSS 的响应式设计，操作丝滑。
- 🔄 **动态数据获取**：通过 GraphQL API 实时获取场馆列表和可用座位，无需手动维护静态数据。
- 🏫 **多学校支持**：内置预设配置（卤蛋大学、官方原版），支持自定义 API 地址、Origin 和 Referer。
- 🌙 **深色/浅色模式**：自动适应系统主题或手动切换，采用中性灰色调深色主题。
- 🕒 **智能定时**：支持立即执行、预设时间（21:48）或自定义时间（精确到秒）。
- 📊 **实时状态反馈**：WebSocket 实时推送抢座日志和结果，零延迟。
- 📱 **移动友好**：完美适配 iOS/Android，针对移动端输入进行专项优化。

## 📋 目录

- [安装指南](#-安装指南)
- [项目结构](#-项目结构)
- [使用方法](#-使用方法)
- [界面预览](#-界面预览)
- [常见问题](#-常见问题)
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
   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   
   # Windows
   python -m venv venv
   venv\Scripts\activate
   ```
3. **安装依赖包**

   ```bash
   pip install -r requirements.txt
   ```

## 🏗️ 项目结构

经过重构，项目现在采用模块化结构：

- `main.py`: 项目的统一启动入口。
- `config.py`: 存放所有全局配置、URL和请求头。
- `core.py`: **[Async]** 封装了最核心的抢座/预约业务逻辑，使用 `httpx` 和 `websockets`。
- `web_app.py`: **[Async]** FastAPI Web 服务层，处理 HTTP/WebSocket 请求。
- `tasks.py`: **[Async]** 异步后台任务调度器，使用 `asyncio` 协程运行定时任务。
- `cli.py`: **[Async]** 命令行版本，适配了异步核心。
- `data_utils.py`: 负责加载阅览室、座位等静态映射数据。
- `data_provider.py`: **[Async]** 动态数据提供器，通过 GraphQL API 实时获取场馆和座位信息。
- `globals.py`: 存放跨模块共享的全局变量。
- `models.py`: 定义 Pydantic 数据模型。
- `data_process/`: 存放预处理的静态数据。
- `frontend/`: React 前端项目源码。

## 🚀 使用方法

项目支持 Web 界面和命令行两种模式，通过 `main.py` 启动。

项目分为后端 API 服务和 React 前端应用。

### 1. 启动后端 API 服务

在激活虚拟环境后，运行：

```bash
python main.py
```

后端服务将在 `http://127.0.0.1:8000` 启动 API 文档地址: `http://127.0.0.1:8000/docs`

### 2. 启动前端 React 应用

进入 `frontend` 目录并启动开发服务器：

```bash
cd frontend
pnpm install
pnpm dev
```

前端页面通常将在 `http://127.0.0.1:5173` 访问。

### 3. 访问

打开浏览器访问前端地址 (如 `http://127.0.0.1:5173`) 即可使用。后端只负责提供 API 接口。

### 使用流程

1. **Landing Page 页面**：
   - 项目介绍
   - 项目功能特点
   - 点击 `进入系统` 按钮
2. **填写配置**：
   - 选择操作模式（明日预约/立即抢座）
   - 填写 Cookie 信息（需自行抓包获取，教程还没写 T^T）
   - 选择阅览室和填写座位号
   - 设置执行时间（立即执行/默认时间/自定义时间）
   - 启动任务
3. **查看状态**：
   - 实时查看预约/抢座进度
   - 查看详细操作日志
   - 获取最终结果

## 🖼️ 界面预览



<img src="https://s2.loli.net/2026/01/24/dMJ9Kwi8VejqP4f.jpg" width="100%" />



<p align="center">
  <img src="https://s2.loli.net/2026/01/24/m1qXWvlsOSxRwb6.jpg" width="35%" />
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://s2.loli.net/2026/01/24/pUsoX3WvQPCl62a.jpg" width="35%" />
</p>



## ❓ 常见问题

### Q: 如何获取Cookie？

A: 您需要使用抓包软件从图书馆小程序登录后获取 Cookie 信息（教程还没写...大家应该都会..吧..）。

### Q: 预约失败怎么办？

A: 常见原因包括 Cookie 失效、座位已被预约或网络问题。请检查 Cookie 是否有效，并尝试选择其他座位。

### Q: 支持哪些浏览器？

A: 支持所有浏览器，包括 Chrome、Firefox、Edge、Safari 等，并且对移动设备浏览器做了特别优化。

## 🤝 贡献指南

欢迎提交问题报告和功能请求！如果您想贡献代码：

1. Fork这个仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个Pull Request

## 📄 许可证

该项目采用MIT许可证 - 详情请参阅LICENSE文件

---

**注意**：本项目仅供学习和研究使用，请遵守图书馆相关规定和校园网络使用规范。

**注意**：本项目仅供学习和研究使用，请遵守图书馆相关规定和校园网络使用规范。

**注意**：本项目仅供学习和研究使用，请遵守图书馆相关规定和校园网络使用规范。
