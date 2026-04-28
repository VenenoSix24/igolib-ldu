# 我去抢个座

<p align="center">
  <img src="public/app-icon.png" width="128" height="128" alt="igolib-ldu Icon" />
  <br /><br />
  <a href="https://igolib.ivyris.top"><b>🌐 项目官网</b></a> •
  <a href="https://igolib.ivyris.top/#/download"><b>⬇️ 官网下载</b></a> •
  <a href="https://github.com/VenenoSix24/igolib-ldu/releases/latest"><b>⭐ GitHub下载</b></a>
  <br /><br />
  <img src="https://img.shields.io/badge/App_Version-v1.0.26-2ea44f?style=flat-square&logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/Core_Logic-v4.6.25_TS-E10098?style=flat-square&logo=graphql&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19.2.0-282c34?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Tauri-2.9.6-24C8DB?style=flat-square&logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/LICENSE-AGPL--3.0-red?style=flat-square&logo=open-source-initiative&logoColor=white" />
</p>


一个基于 **React + TypeScript + Tauri** 的全平台图书馆座位预约系统。

本项目已完成从 **Python 后端** 到 **纯前端驱动跨平台架构** 的全面迁移。核心逻辑、GraphQL API 交互、WebSocket 队列处理以及任务调度器均已重写为 TypeScript 模块。通过使用 Tauri 2.0，应用现已完美适配 **Android、Windows、macOS 以及 Linux** 平台，提供一致的体验。

> 如果你**需要 Python 做为后端**的版本，请切换到 [**dev 分支**](https://github.com/VenenoSix24/igolib-ldu/tree/dev)。Python 版本可能会更新不及时！
> 
> **如果对你有帮助，请 Star 一下项目吧！** ⭐

![igolib-ts-p1.jpg](https://s2.loli.net/2026/01/25/YaLWsrDVJHZwITf.jpg)

*(基于某个我去图书馆，谁去图书馆？！！)*

## ✨ 功能特性

- 📱 **全平台覆盖**：支持运行在手机端（Android）与桌面端（Win/Mac/Linux）。
- 🚀 **纯单机驱动**：核心逻辑异步化重写，无需额外部署 Python 后端，本地直接与图书馆服务器通信。
- 🔑 **自动获取凭证**：支持微信扫码解析凭证，通过简单的二维码扫描即可自动获取 Cookie，无需手动抓包。
- 🔄 **明日预约模式**：支持 WebSocket 排队通道模拟，在开放瞬间精准抢占次日座位。
- ⚡ **即时抢座模式**：实时抢占当天可用座位，智能优化重试策略。
- 🌐 **精美 Web UI**：采用 TailwindCSS 和 Framer Motion，支持流畅的交互与响应式布局。
- 🌙 **深色模式支持**：适配系统主题，自由切换主题或跟随系统设置。
- 🔄 **动态数据获取**：实时动态获取场馆状态，告别静态场馆映射数据。
- 🏫 **多校区自由配置**：支持自定义 API 域名、Origin 与 Referer，适配不同学校系统。

## 📥 快速下载 (推荐)

如果您只是单纯想使用本软件，可以直接从 [Releases 页面](https://github.com/VenenoSix24/igolib-ldu/releases) 或 [官网页面](https://igolib.ivyris.top/#/download) 下载对应平台的安装包：

- **Android**: 下载 `.apk` 文件。
- **Windows**: 下载 `.msi` 或 `.exe` 安装包。
- **macOS**: 下载 `.dmg` 文件。
- **Linux**: 下载 `.AppImage` 或 `.deb` 包。

## 🛠️ 编译运行

如果您希望参与开发或自行从源码构建应用：

### 环境要求
- [Node.js](https://nodejs.org/) (推荐 v22+) & [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/)
- **移动端编译额外要求**: [Android Studio](https://developer.android.com/studio) (Android) 或 [Xcode](https://developer.apple.com/xcode/) (iOS)

### 开发运行
1. **安装依赖**
   ```bash
   pnpm install
   ```
2. **桌面端预览**
   ```bash
   pnpm tauri dev
   ```
3. **移动端预览**
   ```bash
   pnpm tauri android dev
   # 或
   pnpm tauri ios dev
   ```

### 编译打包
```bash
pnpm tauri build                # 打包桌面端
pnpm tauri android build        # 打包 Android
```

## 🏗️ 项目结构

- `src-tauri/`: Tauri 原生配置、权限定义。
- `src/`:
  - `services/`:
    - `LibraryService.ts`: **核心逻辑** - 封装 GraphQL 协议。
    - `SchedulerService.ts`: **进程调度** - 负责精准抢座触发。
    - `WebSocketService.ts`: 模拟 WebSocket 排队协议。
  - `pages/`: 应用主视图 (Dashboard, LandingPage)。
  - `components/`: UI 组件仓库。

## 🚀 使用流程

1. **配置学校**：点击设置图标，确认/修改当前学校的 API 全局路径。
2. **凭证获取**：点击输入框侧边的“扫码获取”按钮，跟随指引使用微信扫描二维码并复制链接。粘贴链接并解析 Cookie。
3. **智能选座**：从动态列表选择场馆，手动或通过列表指定座位号。
4. **启动任务**：设定好执行时间，点击“开始任务”，保持应用运行，系统将自动接管后续的排队与抢占逻辑。

## 🖼️ 界面预览

![igolib-ldu-web-home.png](https://files.seeusercontent.com/2026/03/10/1dzV/igolib-ldu-web-home.png)

![igolib-ts-p4.jpg](https://s2.loli.net/2026/01/25/tYDSefbR5quG8my.jpg)

<img src="https://s2.loli.net/2026/01/25/TCFcJxO317gMfjy.jpg" alt="igolib-ts-p3.jpg" style="zoom: 33%;" />


## 📄 许可证

本项目采用 **AGPL-3.0** 开源许可证。


- 任何使用本项目代码的衍生项目 **必须开源**
- 修改后的代码 **必须以 AGPL-3.0 进行发布**
- 即使作为 **网络服务运行** 也需要提供源代码

详情请查看 [LICENSE](./LICENSE) 文件。

---

**声明**：本项目仅供学术交流与编程技术研究使用，请自觉遵守各高校图书馆座位管理规定！严禁用于任何商业用途！！
