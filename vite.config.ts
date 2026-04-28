import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// @ts-ignore
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 防止 Vite 隐藏 Rust 编译阶段的错误
  clearScreen: false,

  // 为 Tauri 开发环境配置服务器
  server: {
    // 确保这里的端口与 tauri.conf.json 中的 devUrl 端口一致
    port: 5173,
    // Tauri 预期一个固定端口，如果端口被占用则直接报错
    strictPort: true,
    // 如果设置了 TAURI_DEV_HOST，则使用它
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 告诉 Vite 忽略监听 src-tauri 文件夹
      ignored: ["**/src-tauri/**"],
    },
  },

  // 别名配置，方便项目内部使用 @ 导入组件
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // 以 VITE_ 或 TAURI_ENV_ 开头的环境变量将通过 import.meta.env 暴露给前端
  envPrefix: ["VITE_", "TAURI_ENV_*"],

  build: {
    // Tauri 在 Windows 和 Android 上使用 Chromium，在 macOS 和 Linux 上使用 WebKit
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ||
        process.env.TAURI_ENV_PLATFORM === "android"
        ? "chrome105"
        : "safari13",
    // 为调试构建保留可读性
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // 为调试构建产生 sourcemap
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
