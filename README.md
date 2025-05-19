# igolib-ldu-web 图书馆座位预约系统

<p align="center">
  <img src="https://img.shields.io/badge/版本-v2.2.0-blue.svg" alt="版本" />
  <img src="https://img.shields.io/badge/Python-3.8+-brightgreen.svg" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.115+-orange.svg" alt="FastAPI" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="许可证" />
</p>

<p align="center">
  <b>一个现代、高效的图书馆座位预约工具 | 专为鲁东大学图书馆设计</b>
</p>

<div align="center">

[特点](#特点) •
[快速开始](#快速开始) •
[使用指南](#使用指南) •
[Cookie获取](#cookie获取) •
[高级配置](#高级配置) •
[常见问题](#常见问题) •
[贡献](#贡献) •
[许可证](#许可证)

</div>

## ✨ 特点

- 📚 **双模式操作**：支持明日预约和实时抢座
- 🚀 **高效预约**：内置排队系统，提高抢座成功率
- ⏰ **定时执行**：设定精确时间自动执行预约/抢座
- 💻 **友好界面**：简洁美观的Web界面，响应式设计
- 🔍 **座位映射**：完整的阅览室座位映射，轻松选择

## 🚀 快速开始

### 系统要求

- Python 3.8+
- 网络连接
- 支持Windows/MacOS/Linux

### 安装步骤

1. 克隆仓库:

```bash
git clone https://github.com/VenenoSix24/igolib_ldu_web.git
cd igolib_ldu_web
```

2. 安装依赖:

```bash
pip install -r requirements.txt
```

3. 启动Web服务:

```bash
uvicorn beta:app --reload --host 0.0.0.0 --port 8000
```

4. 在浏览器访问:

```
http://127.0.0.1:8000
```

## 📖 使用指南

### Web界面操作流程

1. **选择操作模式**:
   - 明日预约 (在规定时间窗口内执行)
   - 立即抢座 (可选择立即或定时执行)

2. **填写必要信息**:
   - 阅览室选择
   - 座位号输入
   - Cookie信息填写
   - 执行时间设置 (可选)

3. **提交请求**:
   - 点击"开始执行"按钮
   - 实时查看操作状态和结果

## 🔑 Cookie获取

获取Cookie是使用本工具的关键步骤，以下是手动获取Cookie的方法:

### 使用浏览器开发者工具

1. 在微信中打开图书馆预约系统
2. 按F12或右键选择"检查"打开开发者工具
3. 切换到"网络(Network)"选项卡
4. 刷新页面，查找带有Authorization的请求
5. 复制请求头中的Cookie值

### 使用抓包工具

1. 配置并启动抓包软件(如Fiddler、Charles等)
2. 使用微信访问图书馆系统
3. 在抓包工具中查找相关请求
4. 提取请求中的Cookie信息

## ⚙️ 高级配置

在beta.py文件中可以修改以下配置:

```python
# 抢座最大尝试次数
MAX_REQUEST_ATTEMPTS = 3

# 预约窗口时间
TOMORROW_RESERVE_WINDOW_START = datetime.time(21, 48, 0)
TOMORROW_RESERVE_WINDOW_END = datetime.time(23, 59, 59)

# 默认预约时间
DEFAULT_RESERVE_TIME_STR = "21:48:00"
```

## ❓ 常见问题

| 问题 | 解决方案 |
|------|---------|
| Cookie无效 | 重新登录获取新Cookie，确保包含完整的Authorization值 |
| 抢座失败 | 检查时间设置，确保与服务器时间同步；尝试选择其他座位 |
| 网页连接失败 | 检查网络连接，确保服务正在运行；尝试刷新页面 |
| 座位被占用 | 更换其他座位号重新尝试 |

## 🤝 贡献

欢迎提交问题和贡献代码，让这个工具变得更好!

1. Fork 本项目
2. 创建特性分支: `git checkout -b my-new-feature`
3. 提交更改: `git commit -am '添加新特性'`
4. 推送到分支: `git push origin my-new-feature`
5. 提交Pull Request

## 📄 许可证

本项目采用MIT许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

---

<p align="center">开发不易，如果这个项目对你有帮助，请给它一个星标 ⭐</p>
