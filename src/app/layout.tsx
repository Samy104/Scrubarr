import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata = {
  title: 'Scrubarr - Plex duplicate manager',
  description: 'Scrub duplicate movies, episodes, and anime from Plex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
