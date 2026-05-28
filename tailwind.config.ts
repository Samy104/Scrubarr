import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0b0d10',
        panel:    '#14181f',
        'panel-2':'#1c222b',
        border:   'rgb(42 49 59 / 1)',
        text:     '#e8ecf1',
        'text-dim': '#8b96a4',
        accent:   '#7eb6ff',
        good:     '#5dd39e',
        warn:     '#ffc57e',
        danger:   '#ff7575',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
