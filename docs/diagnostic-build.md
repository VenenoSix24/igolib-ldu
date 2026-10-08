# 诊断版（日志分支）

这个分支的目标只有一个：**让用户在出问题时能直接把日志发出来，而不是只能发截图。**

它基于发布线 `tauri-ts` 分出（非 2.0 重构线），产出与正式版**互相独立、可同时安装**的诊断版安装包。

## 词汇约定

这套东西有三个名字，各管一摊，别混用：

| 用途 | 用词 | 出现在 |
| --- | --- | --- |
| 对外技术标识 | `debug` | tag、资产名、`tauri.debug*.conf.json`、`debug:*` npm 脚本、`IS_DEBUG_BUILD` |
| 中文显示名 | 诊断版 | 安装包名、面板标题、Release 标题 |
| 代码模块（功能名） | `diagnostics` | `diag_info` 等命令、`DiagnosticsModal`、`diagnostics.ts` |

理由：`debug` 是给用户看的（URL、下载文件名），中文用户一看就懂；「诊断版」比「调试版」更不容易让人以为软件有问题；代码里 `diagnostics` 才是"诊断日志"这个功能的准确术语。

## 相比正式版做了什么

| 能力 | 正式版 | 诊断版 |
| --- | --- | --- |
| release 构建落盘日志 | 无（`tauri-plugin-log` 仅在 debug 启用） | 有，写到应用日志目录，单文件 4MB、保留 3 份 |
| 前端日志 | 仅 `console.log`，用户看不到 | 统一 logger，脱敏后落盘 |
| 应用内查看/导出 | 无 | 「诊断日志」面板，一键复制 / 导出文件 / 打开日志目录 |
| 网络链路 | 无请求/响应记录 | 记录 operationName、URL、请求头、variables、状态码、耗时、响应体 |
| 崩溃 | 无记录 | 捕获 `error` / `unhandledrejection` |
| 构建戳 | 无 | 面板 / 报告 / 日志启动行都带 `版本-run号-commit-时间` |
| 应用标识（桌面） | `com.igolib.ldu` | `com.igolib.ldu.debug`，可与正式版共存 |
| 应用标识（安卓） | `com.igolib.ldu` | 同为 `com.igolib.ldu`，安装会替换正式版（原因见下） |

日志里的 Cookie / Authorization / token / 学号类字段会**自动脱敏**（保留键名与长度，值只留少量前后缀），报告仅落本地、不会自动上传。

## 构建

```bash
pnpm debug:dev      # 调试模式开发（配置页标题旁会显示「诊断版」角标）
pnpm debug:build    # 产出诊断版安装包（macOS: .app/.dmg，Windows: nsis/msi，Linux: deb/appimage/rpm）
pnpm debug:android  # 安卓 APK
```

前两者通过 `src-tauri/tauri.debug.conf.json` 覆盖：

- `productName` → `我去抢个座(诊断版)`
- `identifier` → `com.igolib.ldu.debug`（与正式版不同，因此可同时安装、互不覆盖）
- `bundle.createUpdaterArtifacts` → `false`（诊断版不做更新签名）
- 前端以 `--mode debug` 构建，`IS_DEBUG_BUILD` 因此为真 → 跳过更新检查、显示「诊断版」角标

`--config` 只覆盖上面这些，**不动 `app.windows`**，避免覆盖 `tauri.android.conf.json` 里的安卓窗口设置。

### Android

安卓**不能**用改过 `identifier` 的那份配置：Tauri CLI 会按 identifier 推导 `gen/android` 下的工程目录
（`.../java/com/igolib/ldu/debug`），目录不存在就直接报错。所以安卓用单独的一份配置，只切换成调试模式：

```bash
pnpm debug:android  # = tauri android build --apk --config src-tauri/tauri.debug.mobile.conf.json
```

代价要说清楚：**安卓诊断版沿用原包名 `com.igolib.ldu`，安装会替换正式版**（反之亦然）。
诊断能力、面板与「诊断版」角标都不受影响，APK 文件名也带 `debug-`。
好处是日志目录与正式版相同，来回换版本时历史日志不会丢。

如果确实需要安卓上两个包共存，得为诊断版重建一套安卓工程
（`tauri android init` 会按 identifier 生成 `gen/android`，一个仓库只能有一套），
或在 `gen/android` 里同时维护两个包名的 MainActivity 并让 gradle 按环境变量切换 namespace，
两种做法都会碰到 `gen/android` 被重新生成时丢失改动的风险，目前没有采用。

## CI

`.github/workflows/debug-build.yml` 手动触发（Actions → **Debug Build**），矩阵与步骤**照搬 `release.yml`**
（含 macOS 双架构、Linux、Windows x64/x86、安卓三个 ABI），只加了必要的诊断差异。

一次运行的流程：

1. 生成唯一标签 `debug-<应用版本>-r<run 号>`（如 `debug-1.0.28-r12`）与构建戳，创建 **draft** Release
2. 8 个构建 job 并行构建并上传资产，资产名带标签：`igolib_ldu-debug-1.0.28-r12-windows-x64-setup.exe`
3. 全部成功后才**发布为 prerelease**，并清理更早的诊断版（保留最近 2 份，含标签）

设计取舍：

- **标签唯一而非固定**：每轮构建互不覆盖，某一轮失败也不会让已经发给用户的旧链接失效
- **先 draft 后发布**：避免用户点进去看到一个空的或残缺的 Release
- **始终 `prerelease: true`**：否则可能被 GitHub 标成 "Latest"，把正式版 `v1.0.28` 顶掉
- **标签必须匹配 `debug-...-r<数字>`**：清理逻辑按前缀删 Release，格式不对直接失败
- 不要用 `v` 开头的标签：`release.yml` 的触发条件是 `push: tags: v*`，会顺带触发一次正式构建

## 日志位置

| 平台 | 路径 |
| --- | --- |
| macOS | `~/Library/Logs/com.igolib.ldu.debug/` |
| Linux | `~/.local/share/com.igolib.ldu.debug/logs/` |
| Windows | `%LOCALAPPDATA%\com.igolib.ldu.debug\logs\` |
| Android | 应用私有目录 `files/logs/`（用面板里的「导出文件」取到可访问位置） |

面板顶部会直接显示当前机器的实际路径，底部「打开日志目录」可在桌面端直接跳转。

## 维护提醒

- 合并回正式线之前，建议**只挑走 logger / 诊断面板**，不要带上 `identifier` 改动、`tauri.debug*.conf.json`
  与 `debug-build.yml`。另外正式版面向所有用户，建议把日志级别默认降到 Info，
  并在面板里给一个「详细模式」开关，让用户复现前主动打开全量。
- 脱敏规则集中在 `src/lib/logger.ts`，新增日志字段时若名字命中敏感名单会自动掩码；如需扩名单改
  `SENSITIVE_KEYS` 与 `INLINE_SECRET` 两处。
