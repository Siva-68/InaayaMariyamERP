/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // HINAYA MARIYAM brand palette
        primary:   '#2E8B57',
        'primary-dark':  '#206B45',
        'primary-light': '#E8F5EC',
        background: '#F7FAF7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Arial', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', 'Baskerville', 'Georgia', 'serif'],
        mono: ['"Courier New"', 'Courier', 'monospace'],
        georgia: ['Georgia', '"Times New Roman"', 'serif'],
      },
      minHeight: {
        touch: '44px',   // minimum accessible touch target
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
