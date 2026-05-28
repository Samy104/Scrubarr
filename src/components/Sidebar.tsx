'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, ListVideo, FileCog, Trash2, EyeOff, Activity, ListTree } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const items = [
  { href: '/',         label: 'Movies',     icon: Film },
  { href: '/episodes', label: 'By episode', icon: ListVideo },
  { href: '/shows',    label: 'By series',  icon: ListTree },
  { divider: true as const, label: '', href: '' },
  { href: '/rules',    label: 'Rules',      icon: FileCog },
  { href: '/ignored',  label: 'Ignored',    icon: EyeOff },
  { href: '/log',      label: 'Delete log', icon: Trash2 },
  { href: '/health',   label: 'Status',     icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-panel border-r border-border flex flex-col py-3 sticky top-0 h-screen flex-shrink-0">
      <div className="px-3 mb-3 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 flex-1 min-w-0 group">
          <span className="text-accent w-7 h-7 inline-flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
              <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.10"/>
              <rect x="6" y="9" width="14" height="18" rx="3" fill="currentColor" fillOpacity="0.20" stroke="currentColor" strokeWidth="1.6"/>
              <rect x="12" y="5" width="14" height="18" rx="3" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="2"/>
              <path d="M28 4 L4 28" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              <circle cx="28" cy="4" r="2" fill="currentColor"/>
            </svg>
          </span>
          <div className="leading-tight min-w-0">
            <div className="font-display text-[16px] font-semibold tracking-tight">Scrubarr</div>
            <div className="text-[9px] uppercase tracking-[0.16em] text-text-dim mt-0.5">Plex dedupe</div>
          </div>
        </Link>
        <ThemeToggle compact />
      </div>

      <nav className="flex-1 flex flex-col gap-px">
        {items.map((item, i) => {
          if ('divider' in item) return <div key={i} className="h-px bg-border my-2 mx-3" />;
          const Icon = item.icon;
          const active = pathname === item.href || (item.href === '/episodes' && (pathname === '/tv' || pathname === '/anime'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 px-3 py-2 rounded-md flex items-center gap-2.5 text-sm transition-colors ${
                active
                  ? 'bg-accent/12 text-accent font-medium'
                  : 'text-text-dim hover:bg-panel-2 hover:text-text'
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
