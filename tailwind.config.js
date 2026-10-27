/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      spacing: {
        13: '3.25rem',
      },
      colors: {
        neonBlue: '#0ea5e9',
        neonCyan: '#06b6d4',
        softPurple: '#8b5cf6',
        canvas: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-hover': '#F8FAFC',
        primary: '#FCA311',
        amber: '#FCA311',
        navy: '#14213D',
        'text-main': '#14213D',
        'text-muted': '#475569',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'neon': '0 0 20px rgba(252, 163, 17, 0.35)',
      },
      backgroundImage: {
        'gradient-futuristic': 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.15)',
        'spring-snappy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring-smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
