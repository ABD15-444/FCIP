/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b14',
          900: '#0b1120',
          800: '#111b2e',
          700: '#1e293b',
        },
        crime: {
          red: '#ef4444',
          amber: '#f59e0b',
          emerald: '#10b981',
          cyan: '#06b6d4',
          indigo: '#6366f1',
        }
      }
    },
  },
  plugins: [],
}
