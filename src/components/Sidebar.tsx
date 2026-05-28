'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Tv, Sparkles, FileCog, Trash2, EyeOff, Activity } from 'lucide-react';

const items = [
  { href: '/',          label: 'Movies',     icon: Film },
  { href: '/tv',        label: 'TV Shows',   icon: Tv },
  { href: '/anime',     label: 'Anime',      icon: Sparkles },
  { divider: true as const, label: '', href: '' },
  { href: '/rules',     label: 'Rules',      icon: FileCog },
  { href: '/ignored',   label: 'Ignored',    icon: EyeOff },
  { href: '/log',       label: 'Delete log', icon: Trash2 },
  { href: '/health',    label: 'Status',     icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-panel border-r border-border flex flex-col py-3 sticky top-0 h-screen flex-shrink-0">
      <div className="px-4 py-2 mb-2">
        <div className="text-lg font-semibold">Scrubarr</div>
        <div className="text-xs text-text-dim">Plex duplicate manager</div>
      </div>
      <nav className="flex-1 flex flex-col gap-px">
        {items.map((item, i) => {
          if ('divider' in item) return <div key={i} className="h-px bg-border my-2 mx-3" />;
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${
                active ? 'bg-accent/15 text-accent' : 'hover:bg-panel-2 text-text-dim hover:text-text'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
