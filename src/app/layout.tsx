import './globals.css';
import { Outfit, Manrope, JetBrains_Mono } from 'next/font/google';
import { Sidebar } from '@/components/Sidebar';

const display = Outfit({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['500', '600', '700'] });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap', weight: ['400', '500', '600', '700'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  title: 'Scrubarr',
  description: 'Scrub duplicate movies, episodes, and anime from Plex',
  icons: { icon: '/favicon.svg' },
};

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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
