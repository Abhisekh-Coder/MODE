/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        mode: {
          bg: '#fafafa',
          card: '#ffffff',
          border: '#e5e7eb',
          'border-light': '#f3f4f6',
          text: '#111827',
          'text-secondary': '#6b7280',
          'text-muted': '#9ca3af',
          accent: '#3b82f6',
          'accent-light': '#eff6ff',
          success: '#22c55e',
          'success-light': '#f0fdf4',
          warning: '#f59e0b',
          'warning-light': '#fffbeb',
          danger: '#ef4444',
          'danger-light': '#fef2f2',
        },
      },
      animation: {
        blink: 'blink 1.2s infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};
