import { createContext, useContext } from "react"
import { useThemeStore } from "../stores/theme"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: "system",
  setTheme: () => null,
})

/**
 * 旧页面的主题入口，内部代理 2.0 的 theme store。
 * wallpaper 模式对旧组件呈现为 dark；DOM 应用统一由 ThemeSync 处理。
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  const legacyTheme: Theme = mode === "wallpaper" ? "dark" : mode

  const value = {
    theme: legacyTheme,
    setTheme: (theme: Theme) => setMode(theme),
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  return context
}
