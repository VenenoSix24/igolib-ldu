import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // src-tauri/target 是构建产物（含 Tauri 嵌入的前端资源），不该参与 lint，
  // 否则 lint 结果会随"本地是否跑过 tauri build"而变
  globalIgnores(['dist', '.history', '.claude', 'src-tauri/target', 'src-tauri/gen/schemas']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
