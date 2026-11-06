/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070B14',
          900: '#0B1120',
          850: '#0F172A',
          800: '#131C33',
        },
        brand: {
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6D5EF8',
          600: '#5B4BE0',
        },
        accent: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(109, 94, 248, 0.45)',
        card: '0 8px 30px rgba(2, 6, 23, 0.45)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        fadeUp: 'fadeUp .4s ease both',
      },
    },
  },
  plugins: [],
};
