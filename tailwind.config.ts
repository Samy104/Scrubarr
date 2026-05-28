import type { Config } from 'tailwindcss';

const css = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:         css('bg'),
        panel:      css('panel'),
        'panel-2':  css('panel-2'),
        border:     css('border'),
        text:       css('text'),
        'text-dim': css('text-dim'),
        accent:     css('accent'),
        'accent-ink': css('accent-ink'),
        good:       css('good'),
        warn:       css('warn'),
        danger:     css('danger'),
      },
      fontFamily: {
        sans:    ['var(--font-sans)',    'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)',    'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
