'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') ?? 'dark') as 'dark' | 'light';
    setTheme(t);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('scrubarr-theme', next); } catch {}
  };

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  if (compact) {
    return (
      <button
        onClick={toggle}
        title={label}
        aria-label={label}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-panel-2 transition-colors"
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="w-full mx-2 px-3 py-2 rounded-md flex items-center gap-2 text-sm text-text-dim hover:bg-panel-2 hover:text-text transition-colors"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
