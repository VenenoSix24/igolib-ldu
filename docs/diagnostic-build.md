# 诊断版（日志分支）

这个分支的目标只有一个：**让用户在出问题时能直接把日志发出来，而不是只能发截图。**

它基于发布线 `tauri-ts` 分出（非 2.0 重构线），产出与正式版**互相独立、可同时安装**的诊断版安装包。

## 相比正式版做了什么

| 能力 | 正式版 | 诊断版 |
| --- | --- | --- |
| release 构建落盘日志 | 无（`tauri-plugin-log` 仅在 debug 启用） | 有，写到应用日志目录，单文件 4MB、保留 3 份 |
| 前端日志 | 仅 `console.log`，用户看不到 | 统一 logger，脱敏后落盘 |
| 应用内查看/导出 | 无 | 「诊断日志」面板，一键复制 / 导出文件 / 打开日志目录 |
| 网络链路 | 无请求/响应记录 | 记录 operationName、URL、请求头、variables、状态码、耗时、响应体 |
| 崩溃 | 无记录 | 捕获 `error` / `unhandledrejection` |

日志里的 Cookie / Authorization / token / 学号类字段会**自动脱敏**（保留键名与长度，值只留少量前后缀），报告仅落本地、不会自动上传。

## 构建

```bash
pnpm diag:dev      # 诊断模式开发（窗口内左侧标题会显示「诊断版」角标）
pnpm diag:build    # 产出诊断版安装包（macOS: .app/.dmg，Windows: nsis/msi，Linux: deb/appimage/rpm）
```

两者都会通过 `src-tauri/tauri.diag.conf.json` 覆盖：

- `productName` → `我去抢个座(诊断版)`
- `identifier` → `com.igolib.ldu.diag`（与正式版不同，因此可同时安装、互不覆盖）
- `bundle.createUpdaterArtifacts` → `false`（诊断版不做更新签名）
- 前端以 `--mode diagnostic` 构建，`IS_DIAGNOSTIC_BUILD` 因此为真 → 跳过更新检查、显示「诊断版」角标

`--config` 只覆盖上面这些，**不动 `app.windows`**，避免覆盖 `tauri.android.conf.json` 里的安卓窗口设置。

### Android

安卓包名由 `src-tauri/gen/android/app/build.gradle.kts` 中的环境变量控制，便于与正式版共存：

```bash
IGOLIB_ANDROID_APP_ID=com.igolib.ldu.diag \
  pnpm tauri android build --apk --config src-tauri/tauri.diag.conf.json
```

> 注意：`src-tauri/gen/android/` 是 `tauri android init` 重新生成的目录，重新初始化后需要把该环境变量改回去。

### CI

`.github/workflows/diag-build.yml` 手动触发（Actions → Diagnostic Build），默认只构建桌面端，勾选 `android` 才会附带 APK。产物挂在一个 draft Release 上（默认标签 `diag-latest`），不会发布为正式版本。

## 日志位置

| 平台 | 路径 |
| --- | --- |
| macOS | `~/Library/Logs/com.igolib.ldu.diag/` |
| Linux | `~/.local/share/com.igolib.ldu.diag/logs/` |
| Windows | `%LOCALAPPDATA%\com.igolib.ldu.diag\logs\` |
| Android | 应用私有目录 `files/logs/`（用面板里的「导出文件」取到可访问位置） |

面板顶部会直接显示当前机器的实际路径，底部「打开日志目录」可在桌面端直接跳转。

## 维护提醒

- 合并回正式线之前，建议**只挑走 logger / 诊断面板**，不要带上 `identifier` 改动与 `diag-build.yml`。
- 脱敏规则集中在 `src/lib/logger.ts`，新增日志字段时若名字命中敏感名单会自动掩码；如需扩名单改 `SENSITIVE_KEYS` 与 `INLINE_SECRET` 两处。
