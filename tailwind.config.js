/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D0D0D',
        card: '#1A1F2E',
        'green-primary': '#2D6A4F',
        'green-light': '#40916C',
        'green-cta': '#1B4332',
        'text-primary': '#FFFFFF',
        'text-secondary': '#8B9099',
        star: '#FFB800',
        'toggle-on': '#4CAF50',
        'toggle-off': '#3A3F4B',
        chip: '#1E2435',
        'chip-border': '#2A3045',
        error: '#EF4444',
        success: '#22C55E',
      },
    },
  },
  plugins: [],
}
