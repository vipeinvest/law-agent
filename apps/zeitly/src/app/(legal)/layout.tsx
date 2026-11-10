import type { ReactNode } from 'react';
import Link from 'next/link';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-card">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold">
            Fairhours
          </Link>
          <nav className="text-sm flex gap-4 text-muted">
            <Link href="/datenschutz">Datenschutz</Link>
            <Link href="/impressum">Impressum</Link>
            <Link href="/login" className="text-brand font-semibold">
              Anmelden
            </Link>
          </nav>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 py-8 prose-sm text-[15px] leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:p-2 [&_td]:p-2 [&_td]:border-t [&_td]:border-line">{children}</article>
    </main>
  );
}
