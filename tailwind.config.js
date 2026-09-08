import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          DEFAULT: '#2F56D9',
          50: '#EEF1FC',
          100: '#DCE3FA',
          200: '#B9C7F4',
          300: '#96ABEF',
          400: '#738FE9',
          500: '#5073E3',
          600: '#2F56D9',
          700: '#2544AD',
          800: '#1C3382',
          900: '#122156',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 6px -1px rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
}
