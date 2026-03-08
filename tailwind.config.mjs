/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        warm: {
          50:  '#fafaf8',
          100: '#f5f4f0',
          200: '#eae8e1',
          300: '#d4d1c7',
          400: '#b0ac9f',
          500: '#8b8578',
          600: '#6b6b63',
          700: '#4a4a44',
          800: '#2a2a28',
          900: '#1a1a18',
          950: '#0f0f0e',
        },
        accent: {
          DEFAULT: '#8b7355',
          light:   '#c4956a',
          muted:   'rgba(139,115,85,0.10)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  darkMode: 'class',
};
