/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '360px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
        },
        verification: {
          supported: '#16a34a', // green
          corroborated: '#0d9488', // teal
          'needs confirmation': '#d97706', // amber
          conflicting: '#dc2626', // red
          unknown: '#6b7280', // gray
        }
      }
    },
  },
  plugins: [],
}

