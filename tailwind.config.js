/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@ferrucc-io/emoji-picker/dist/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter Variable"', '"Inter"',
          'system-ui', '-apple-system', '"Segoe UI"', 'Roboto',
          '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas',
          '"Liberation Mono"', '"Courier New"', 'monospace',
        ],
      },
      colors: {
        canvas: {
          deepest: 'var(--canvas-deepest)',
          base: 'var(--canvas-base)',
          panel: 'var(--canvas-panel)',
          raised: 'var(--canvas-raised)',
          hover: 'var(--canvas-hover)',
        },
        ink: {
          primary: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          tertiary: 'var(--ink-tertiary)',
          quaternary: 'var(--ink-quaternary)',
        },
        accent: {
          DEFAULT: 'var(--accent-default)',
          bright: 'var(--accent-bright)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
        line: {
          DEFAULT: 'var(--line-3)',
          subtle: 'var(--line-1)',
          2: 'var(--line-2)',
          4: 'var(--line-4)',
          solid: '#23252a',
        },
        surface: {
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
          5: 'var(--surface-5)',
          6: 'var(--surface-6)',
        },
        divider: 'var(--divider)',
        success: {
          DEFAULT: '#27a644',
          bright: '#10b981',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted: '#7f1d1d',
        },
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)',
        'dialog': 'var(--shadow-dialog)',
        'focus': 'var(--shadow-focus)',
        'inset': 'var(--shadow-inset)',
      },
      letterSpacing: {
        'display': '-.022em',
        'heading': '-.016em',
        'tight': '-.011em',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.5', letterSpacing: '-0.015em' }],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(4px)" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "fade-out": "fade-out 0.15s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
