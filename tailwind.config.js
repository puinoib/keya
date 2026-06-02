/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
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
        // ── Linear canvas ──
        canvas: {
          deepest: '#010102',   // page bg
          base:   '#08090a',    // marketing black
          panel:  '#0f1011',    // sidebar
          raised: '#191a1b',    // elevated surface
          hover:  '#28282c',    // hover state
        },
        // ── Linear text ──
        ink: {
          primary:   '#f7f8f8',  // near-white
          secondary: '#d0d6e0',  // silver
          tertiary:  '#8a8f98',  // muted
          quaternary:'#62666d',  // subtle
        },
        // ── Linear accent (the only chromatic color) ──
        accent: {
          DEFAULT: '#5e6ad2',   // brand indigo
          bright:  '#7170ff',   // interactive violet
          hover:   '#828fff',   // hover
          muted:   '#7a7fad',   // security lavender
        },
        // ── Linear borders ──
        line: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          subtle:  'rgba(255,255,255,0.05)',
          solid:   '#23252a',
        },
        // ── Status ──
        success: {
          DEFAULT: '#27a644',
          bright:  '#10b981',
        },
        danger: {
          DEFAULT: '#ef4444',
          muted:   '#7f1d1d',
        },
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      boxShadow: {
        'card': 'rgba(0,0,0,0.2) 0px 0px 0px 1px',
        'elevated': 'rgba(0,0,0,0.4) 0px 2px 4px',
        'dialog': 'rgba(0,0,0,0) 0px 8px 2px, rgba(0,0,0,0.01) 0px 5px 2px, rgba(0,0,0,0.04) 0px 3px 2px, rgba(0,0,0,0.07) 0px 1px 1px, rgba(0,0,0,0.08) 0px 0px 1px',
        'focus': 'rgba(0,0,0,0.1) 0px 4px 12px',
        'inset': 'rgba(0,0,0,0.2) 0px 0px 12px 0px inset',
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
