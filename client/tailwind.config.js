/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fintech: {
          bg: '#080B11',
          surface: '#0D121D',
          card: '#111726',
          'card-elevated': '#161E31',
          'card-hover': '#1B243B',
          border: 'rgba(255, 255, 255, 0.07)',
          'border-subtle': 'rgba(255, 255, 255, 0.04)',
          'border-highlight': 'rgba(16, 185, 129, 0.3)',
          neon: '#00E599',
          lime: '#10B981',
          accent: '#6366F1'
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        }
      },
      boxShadow: {
        'fintech-glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.25)',
        'fintech-glow-lime': '0 0 30px -5px rgba(0, 229, 153, 0.3)',
        'fintech-glow-violet': '0 0 25px -5px rgba(99, 102, 241, 0.25)',
        'fintech-card': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    },
  },
  plugins: [],
}

