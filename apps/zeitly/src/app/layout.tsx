import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Fairhours', template: '%s · Fairhours' },
  description: 'Arbeitszeiterfassung für Österreich – einfach, gesetzeskonform, bereit für die Lohnverrechnung.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Fairhours' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1f5f5b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-AT">
      <body>{children}</body>
    </html>
  );
}
