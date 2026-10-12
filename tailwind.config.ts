import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0b0c0c', 900: '#121414', 800: '#1a1d1c', 700: '#252928', 600: '#3a3f3d' },
        paper: '#f4f1ea',
        accent: { DEFAULT: '#7be3a6', soft: '#a9efc6' },
        urgent: '#ff7a6b',
        warn: '#ffc93c',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
} satisfies Config;
