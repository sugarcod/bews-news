/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        card: '#FFFFFF',
        line: '#E8E1D8',
        brand: { DEFAULT: '#A23526', soft: '#F9ECE9', dark: '#862A1E' },
        ink: '#1A1816',
        muted: '#6B655E',
        stone: { track: '#EFEAE2', deep: '#E5DFD5', tabs: '#F0ECE4' },
        navbg: '#FBF6EE',
        tint: '#FBF3E8',
      },
      fontFamily: {
        sans: ['Inter', 'Heebo', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        he: ['Heebo', 'Arial Hebrew', 'Noto Sans Hebrew', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
