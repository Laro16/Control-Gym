/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // El color de marca vive en variables CSS (--brand-*) que se
        // definen en index.css con el naranja default y se sobreescriben
        // en runtime con el primary_color de cada gimnasio (utils/theme.js)
        brand: {
          50:  'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker': 'flicker 2.2s ease-in-out infinite',
        'pop': 'pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flicker: {
          '0%, 100%': { transform: 'scale(1) rotate(-1.5deg)' },
          '25%':      { transform: 'scale(1.07) rotate(1deg)' },
          '50%':      { transform: 'scale(0.96) rotate(-1deg)' },
          '75%':      { transform: 'scale(1.05) rotate(1.5deg)' },
        },
        pop: {
          '0%':   { transform: 'scale(0.4)', opacity: '0' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
