import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0b0c0c', 900: '#121414', 800: '#1a1d1c', 700: '#252928', 600: '#3a3f3d' },
        paper: '#f4f1ea',
        /** Kept red: buttons, links, the logo. */
        accent: { DEFAULT: '#ff5a5f', soft: '#ff8a8e' },
        /** Money kept and things done. */
        good: '#6fd6a0',
        /** Due this week. */
        urgent: '#ffa94d',
        /** Due this month. */
        warn: '#f5d36b',
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
