# igolib-ldu 图书馆座位预约系统

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.8+-brightgreen.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-orange.svg)

IgoLib-LDU 是一个方便快捷的图书馆座位预约工具，专为鲁东大学图书馆设计。本工具支持明日座位预约和当日实时抢座功能，提供Web界面和命令行两种使用方式，满足不同用户的需求。

## ✨ 功能特点

- 🌟 **双模式支持**：明日预约模式和实时抢座模式
- 🔄 **自动排队**：内置排队系统，提高抢座成功率
- 🕒 **定时执行**：支持设定准确时间执行预约/抢座操作
- 🔍 **Cookie获取**：提供多种Cookie获取方式
  - 自动提取模式 (使用mitmproxy)
  - 手动填写模式
- 🖥️ **多平台界面**：
  - 美观易用的Web界面
  - 简洁高效的命令行界面
- 🏢 **完整座位映射**：准确选择座位，无需记忆复杂座位代码

## 📋 系统要求

- Python 3.8+
- 网络连接
- 支持Windows/MacOS/Linux

## 🚀 快速开始

### 安装

1. 克隆仓库:

```bash
git clone https://github.com/VenenoSix24/igolib_ldu.git
cd igolib_ldu
```

2. 安装依赖:

```bash
pip install -r requirements.txt
```

### 使用方法

#### Web界面 (推荐)

1. 启动Web服务器:

```bash
uvicorn beta:app --reload --host 0.0.0.0 --port 8000
```

2. 访问以下地址:

```
http://127.0.0.1:8000
```

3. 在Web界面中:
   - 选择操作模式 (预约/抢座)
   - 选择阅览室和座位
   - 设置执行时间
   - 填写或自动获取Cookie
   - 点击提交

#### 命令行模式

```bash
python beta.py
```

按照终端提示操作即可完成预约/抢座。

### Cookie获取

#### 自动获取 (推荐)

1. 在Web界面点击"启动Cookie获取器"
2. 按照提示设置系统代理
3. 使用微信登录图书馆系统
4. Cookie将自动保存并填充

#### 手动获取

1. 下载并打开抓包软件
2. 使用微信访问图书馆网站
3. 登录您的账号
4. 打开抓包软件，寻找带有Authorization的请求
5. 复制Cookie值

## 🔧 高级配置

可在beta.py文件中修改以下配置:

```python
# 抢座最大尝试次数
MAX_REQUEST_ATTEMPTS = 3

# 预约窗口时间
TOMORROW_RESERVE_WINDOW_START = datetime.time(21, 48, 0)
TOMORROW_RESERVE_WINDOW_END = datetime.time(23, 59, 59)

# 默认预约时间
DEFAULT_RESERVE_TIME_STR = "21:48:00"
```

## 📸 截图

(应用截图)

## 📝 注意事项

- 本工具仅用于学习和研究目的
- 请勿频繁使用，以免对图书馆系统造成压力
- 请遵循图书馆相关规定使用座位

## 🔍 故障排除

**问题**: Cookie无效
**解决方案**: 重新登录获取新Cookie，确保包含完整的Authorization值

**问题**: 抢座失败
**解决方案**: 检查时间设置，确保与服务器时间同步；尝试选择其他座位

## 📚 参与贡献

1. Fork 本项目
2. 创建特性分支: `git checkout -b my-new-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送到分支: `git push origin my-new-feature`
5. 提交Pull Request

## 📄 许可证

本项目采用MIT许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 🙏 鸣谢

感谢所有为本项目做出贡献的开发者。
