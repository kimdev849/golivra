/** @type {import('tailwindcss').Config} */
module.exports = {
  // Chemins où Tailwind scanne les classes utilisées
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
    './constants/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0E86D4',
          light: '#38A7E8',
          dark: '#0A6CB0',
        },
      },
    },
  },
  plugins: [],
};
