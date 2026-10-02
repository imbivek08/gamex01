import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#0a0f1e',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        },
        turf: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        'hammer-slam': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '40%': { transform: 'rotate(-30deg) scale(1.2)' },
          '60%': { transform: 'rotate(10deg) scale(1.1)' },
          '100%': { transform: 'rotate(0deg) scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'hammer-slam': 'hammer-slam 0.6s ease-in-out',
        'slide-up': 'slide-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
