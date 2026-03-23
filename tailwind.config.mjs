/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        warm: {
          50:  '#f6f5f1',
          100: '#edecea',
          200: '#e5e4df',
          300: '#cccbc4',
          400: '#a3a29a',
          500: '#87867e',
          600: '#555550',
          700: '#3a3a36',
          800: '#1c1c1a',
          900: '#141413',
          950: '#0a0a09',
        },
        accent: {
          DEFAULT: '#141413',
          light:   '#333330',
          muted:   'rgba(20,20,19,0.05)',
        },
      },
      fontFamily: {
        body: ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['DM Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
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
