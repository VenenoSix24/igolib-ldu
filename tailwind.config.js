/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // isle 令牌桥接
        ink: "var(--ink)",
        mut: "var(--mut)",
        sub: "var(--sub)",
        pri: "var(--pri)",
        "pri-deep": "var(--pri-deep)",
        "pri-text": "var(--pri-text)",
        "pri-ink": "var(--pri-ink)",
        acc: "var(--acc)",
        "acc-hi": "var(--acc-hi)",
        ok: "var(--ok)",
        "ok-ink": "var(--ok-ink)",
        warn: "var(--warn)",
        "warn-ink": "var(--warn-ink)",
        err: "var(--err)",
        "err-ink": "var(--err-ink)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // 落地页自定义颜色
        "brand": "#197fe6",
        "brand-dark": "#0e5ea0",
        "background-light": "#f6f7f8",
        "background-dark": "#0f1115",
        "surface-dark": "#161b22",
        "surface-lighter": "#21262d",
        "accent-purple": "#6366f1",
        "accent-indigo": "#4338ca",
        "log-green": "#22c55e",
        "log-red": "#ef4444",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glow': '0 0 20px rgba(25, 127, 230, 0.15)',
        'glow-strong': '0 0 30px rgba(25, 127, 230, 0.3)',
        'silver': '0 0 20px rgba(255, 255, 255, 0.2)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        drift: {
          '0%': { transform: 'translate(0, 0)' },
          '100%': { transform: 'translate(20px, 20px)' },
        },
        beam: {
          '0%': { opacity: '0.3', transform: 'translateX(-10%) skewX(-15deg)' },
          '100%': { opacity: '0.6', transform: 'translateX(10%) skewX(-15deg)' },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'drift': 'drift 20s linear infinite',
        'beam': 'beam 15s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
}

