/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['var(--font-cairo)', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#E86B00',
          600: '#d25e00',
          700: '#b24c00',
          800: '#8e3d00',
          900: '#733200',
        },
        primary: {
          DEFAULT: '#E86B00',
          hover: '#d25e00',
          light: '#fff7ed',
        },
        dark: {
          DEFAULT: '#121212',
          surface: '#171717',
          card: '#1e1e1e',
        },
        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#E86B00',
          600: '#d25e00',
          700: '#b24c00',
          800: '#8e3d00',
          900: '#733200',
        },
      },
      boxShadow: {
        'floating': '0 8px 30px rgb(0,0,0,0.04)',
        'floating-hover': '0 14px 35px rgb(0,0,0,0.08)',
        'floating-lg': '0 20px 40px rgb(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
