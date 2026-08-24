/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        stage: '#0B0B12',
        stage2: '#15141F',
        marquee: '#E8B84B',
        marqueeDim: '#B98F34',
        violet: '#7C5CFC',
        violetDim: '#5B3FD1',
        available: '#34D399',
        booked: '#F0455D',
        paper: '#F7F3EA',
        paperDim: '#C9C4B6',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(232,184,75,0.25)',
        violetGlow: '0 0 30px rgba(124,92,252,0.35)',
      },
      backgroundImage: {
        spotlight: 'radial-gradient(circle at 50% 0%, rgba(232,184,75,0.15), transparent 60%)',
      },
    },
  },
  plugins: [],
};
