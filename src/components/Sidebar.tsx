'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Film, ListVideo, ListTree, FileCog,
  Wand2, Tv2, ScrollText,
  Trash2, EyeOff, Activity,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

type Item =
  | { divider: true; key: string }
  | { section: true; label: string; key: string }
  | { href: string; label: string; icon: LucideIcon; matchPrefix?: boolean; alsoActiveOn?: string[] };

const items: Item[] = [
  { section: true, label: 'Dedupe', key: 'sec-dedupe' },
  { href: '/',         label: 'Movies',     icon: Film },
  { href: '/episodes', label: 'By episode', icon: ListVideo, alsoActiveOn: ['/tv', '/anime'] },
  { href: '/shows',    label: 'By series',  icon: ListTree },
  { href: '/rules',    label: 'Rules',      icon: FileCog },

  { section: true, label: 'Cleanup', key: 'sec-cleanup' },
  { href: '/cleanup/movies',  label: 'Movies',  icon: Wand2 },
  { href: '/cleanup/shows',   label: 'Shows',   icon: Tv2 },
  { href: '/cleanup/rules',   label: 'Rules',   icon: ScrollText },
  { href: '/cleanup/ignored', label: 'Ignored', icon: EyeOff },

  { section: true, label: 'Library', key: 'sec-library' },
  { href: '/ignored',  label: 'Ignored',    icon: EyeOff },
  { href: '/log',      label: 'Delete log', icon: Trash2 },

  { section: true, label: 'System', key: 'sec-system' },
  { href: '/health',   label: 'Status',     icon: Activity },
];

function isActive(pathname: string, item: Extract<Item, { href: string }>): boolean {
  if (pathname === item.href) return true;
  if (item.alsoActiveOn?.includes(pathname)) return true;
  if (item.matchPrefix && pathname.startsWith(item.href + '/')) return true;
  return false;
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 bg-panel border-r border-border flex flex-col py-3 sticky top-0 h-screen flex-shrink-0">
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
            <div className="text-[9px] uppercase tracking-[0.18em] text-text-dim mt-0.5">Plex cleanup suite</div>
          </div>
        </Link>
        <ThemeToggle compact />
      </div>

      <nav className="flex-1 flex flex-col gap-px overflow-y-auto pb-3">
        {items.map((item) => {
          if ('section' in item) {
            return (
              <div key={item.key} className="mt-3 first:mt-1 px-5 pb-1 text-[10px] uppercase tracking-[0.16em] text-text-dim/80 font-medium">
                {item.label}
              </div>
            );
          }
          if ('divider' in item) return <div key={item.key} className="h-px bg-border my-2 mx-3" />;
          const Icon = item.icon;
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 px-3 py-1.5 rounded-md flex items-center gap-2.5 text-[13.5px] transition-colors ${
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
