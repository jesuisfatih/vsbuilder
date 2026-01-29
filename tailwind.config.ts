import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#008060', // Shopify Green
      }
    },
  },
  plugins: [],
} satisfies Config
