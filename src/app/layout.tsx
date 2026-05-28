import './globals.css';
import { Outfit, Manrope, JetBrains_Mono } from 'next/font/google';
import { Sidebar } from '@/components/Sidebar';
import { NotificationProvider } from '@/lib/notifications';
import { NotificationBell } from '@/components/NotificationBell';
import { ConfirmProvider } from '@/lib/confirm';

const display = Outfit({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['500', '600', '700'] });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap', weight: ['400', '500', '600', '700'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'Scrubarr',
  description: 'Scrub duplicate movies, episodes, and anime from Plex',
  icons: { icon: '/favicon.svg' },
};

// Every page in this app reads from Plex + sqlite at request time, so prerender
// is never useful. Forcing dynamic here also satisfies the useSearchParams()
// + Suspense requirement for the cleanup/dedupe rule-filter pages.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var t=localStorage.getItem('scrubarr-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();",
          }}
        />
      </head>
      <body className="font-sans">
        <NotificationProvider>
          <ConfirmProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 min-w-0 relative">
                <NotificationBell />
                {children}
              </main>
            </div>
          </ConfirmProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
