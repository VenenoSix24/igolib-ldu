# 我去抢个座 - Web版

![版本](https://img.shields.io/badge/版本-3.2.1-blue.svg)
![Python](https://img.shields.io/badge/Python-3.9+-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.12-brightgreen.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-2.2.19-38B2AC.svg)
![许可证](https://img.shields.io/badge/许可证-MIT-yellow.svg)

一个现代化的图书馆座位预约和抢座系统Web版，通过精美的响应式界面操作，轻松实现图书馆座位预约。系统支持明日预约和即时抢座两种模式，为用户提供便捷的图书馆座位管理体验。

*基于某个我去图书馆，谁去图书馆？！！*

**（人话：我想要抢一个喜欢的座位！！！！！！！拿来吧你）**

## 👀 悄悄话

**目前：**

* 只支持卤蛋
* 只支持特定场馆（因为我经常用）

**未来：**

* 增加选择他校配置
* 自动获取场馆数据信息（现在的获取方法蠢蠢的）

*咕咕咕...咕咕..*

## 📆 我的待办集

* [X] 重构拆分 beta.py 主程序，增强代码维护性
* [ ] Cookie 获取教程
* [ ] 输入 Cookie 后，检验 Cookie 可用性（好像有些多余）
* [ ] 占座模式（感觉 Cookie 活不到 30 分钟）
* [ ] 取消预约座位（那岂不是还要先检测是否已有预约）
* [ ] 增加动态签到码显示选项
* [ ] 多用户性能优化
* [ ] 动态获取场馆、座位信息

## ✨ 功能特性

- 🔄 **明日预约模式**：在开放时间预约第二天的座位。
- ⚡ **即时抢座模式**：实时抢占当天可用座位（虽然有些鸡肋）。
- 🌐 **精美Web界面**：基于TailwindCSS的响应式设计。
- 🌙 **深色/浅色模式**：自动适应系统主题或手动切换。
- 🕒 **定时执行**：支持立即执行、预设时间或自定义时间三种执行方式。
- 📊 **实时状态**：预约/抢座过程实时反馈，清晰的日志显示。
- 📈 **全站统计**：实时查看本站的总抢座次数、今日次数和最受欢迎阅览室。
- 📱 **移动友好**：完美支持手机访问和操作。
- 🎨 **精美动效**：流畅的过渡动画和交互效果。

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
- pip包管理器

### 安装步骤

1. **克隆或下载项目代码**

   ```bash
   git clone [https://github.com/VenenoSix24/igolib-ldu.git](https://github.com/VenenoSix24/igolib-ldu.git)
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
- `core.py`: 封装了最核心的抢座/预约业务逻辑。
- `web_app.py`: 包含所有 FastAPI Web 服务、API路由和 WebSocket 逻辑。
- `tasks.py`: 后台任务执行器，作为 Web 层和 Core 层的桥梁。
- `cli.py`: 命令行版本的所有功能。
- `data_utils.py`: 负责加载阅览室、座位等静态映射数据。
- `achievements.py`: 负责处理全站统计数据的读写逻辑。
- `globals.py`: 存放跨模块共享的全局变量。
- `models.py`: 定义 Pydantic 数据模型。
- `app_data/`: 存放程序运行时动态生成的数据。
- `data_process/`: 存放预处理的静态数据。
- `templates/` & `static/`: 前端文件。

## 🚀 使用方法

项目支持 Web 界面和命令行两种模式，通过 `main.py` 启动。

### 启动Web服务

在激活虚拟环境后，运行以下命令：

```bash
python main.py --web
```

如果希望局域网内的其他设备（如手机）也能访问，请使用：

```bash
python main.py --web --host 0.0.0.0
```

### 访问Web界面

打开浏览器访问: `http://127.0.0.1:8000` 或 `http://[你的IP地址]:8000`

### 启动命令行界面

如果您想使用纯命令行版本，直接运行：

```bash
python main.py
```

### 使用流程

1. **欢迎页面**：

   - 阅读系统介绍和功能特点
   - 查看系统使用情况统计
   - 同意使用条款和隐私政策
2. **配置页面**：

   - 选择操作模式（明日预约/立即抢座）
   - 填入Cookie信息（需自行抓包获取，教程还没写 T^T）
   - 选择阅览室和填写座位号
   - 设置执行时间（立即执行/默认时间/自定义时间）
   - 提交请求
3. **状态页面**：

   - 实时查看预约/抢座进度
   - 查看详细操作日志
   - 获取最终结果

## 🖼️ 界面预览

太懒了，还没截图...

## ❓ 常见问题

### Q: 如何获取Cookie？

A: 您需要使用抓包软件从图书馆小程序登录后获取Cookie信息（教程还没写...大家应该都会..吧..）。

### Q: 预约失败怎么办？

A: 常见原因包括Cookie失效、座位已被预约或网络问题。请检查Cookie是否有效，并尝试选择其他座位。

### Q: 支持哪些浏览器？

A: 支持所有浏览器，包括Chrome、Firefox、Edge、Safari等，并且对移动设备浏览器做了特别优化。

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
