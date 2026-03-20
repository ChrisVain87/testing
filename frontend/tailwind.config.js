/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        game: {
          dark: '#0d0d1a',
          darker: '#070710',
          surface: '#1a1a2e',
          elevated: '#16213e',
          border: '#0f3460',
          accent: '#e94560',
          gold: '#ffd700',
          green: '#4ade80',
          blue: '#60a5fa',
        },
      },
      fontFamily: {
        game: ['"Press Start 2P"', 'monospace'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(233, 69, 96, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(233, 69, 96, 0.8), 0 0 40px rgba(233, 69, 96, 0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
