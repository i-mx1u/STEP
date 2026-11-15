import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f7fa',
          100: '#e9eef5',
          200: '#cfd9e6',
          300: '#a8b8cc',
          400: '#7b90aa',
          500: '#5a7190',
          600: '#465a76',
          700: '#394a61',
          800: '#29374a',
          900: '#172235',
          950: '#0b1220',
        },
        brand: {
          50: '#eef4ff',
          100: '#dbe7ff',
          200: '#bed2ff',
          300: '#92b4ff',
          400: '#5f8bff',
          500: '#3b66f6',
          600: '#2548e8',
          700: '#1d38d4',
          800: '#1e30ac',
          900: '#1e2f88',
          950: '#171e52',
        },
        sand: {
          50: '#fdfbf7',
          100: '#faf6ee',
          200: '#f3ead9',
          300: '#ead9bd',
          400: '#dcc29a',
          500: '#cda675',
        },
        mint: {
          50: '#effaf5',
          100: '#d9f3e5',
          200: '#b5e6cf',
          300: '#84d3b1',
          400: '#4cba90',
          500: '#2b9f75',
          600: '#1e7f5e',
          700: '#19654c',
          800: '#17513e',
          900: '#144335',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Manrope Variable', ...defaultTheme.fontFamily.sans],
        display: ['Newsreader Variable', 'Georgia', ...defaultTheme.fontFamily.serif],
        arabic: ['Noto Sans Arabic Variable', 'Geeza Pro', 'Segoe UI', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,18,32,0.04), 0 12px 32px -12px rgba(11,18,32,0.12)',
        lift: '0 2px 4px rgba(11,18,32,0.04), 0 24px 48px -20px rgba(11,18,32,0.22)',
        insetline: 'inset 0 -1px 0 rgba(11,18,32,0.06)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        confetti: {
          '0%': { transform: 'translateY(-10px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(70vh) rotate(540deg)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.35s ease both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22,1,0.36,1) both',
        float: 'float 7s ease-in-out infinite',
        confetti: 'confetti 1.8s ease-in forwards',
      },
    },
  },
  plugins: [],
};

export default config;
