import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';
import { DEFAULT_THEME, getOrgBySlug, orgTheme } from '@/lib/org';
import { BrandMark, ThemeStyle } from '@/components/theme';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Anmelden' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { org?: string; next?: string } }) {
  const session = await getSession();
  if (session) redirect(searchParams.next || '/');
  const db = await getDb();
  const org = searchParams.org ? await getOrgBySlug(db, searchParams.org) : null;
  const theme = org ? orgTheme(org) : DEFAULT_THEME;
  const name = org?.theme?.appName || org?.name || 'Zeitly';
  let demoAccounts: Array<{ email: string; name: string; role: string; org: string }> = [];
  if (env.demo) {
    const { rows } = await db.query<{ email: string; name: string; role: string; org: string }>(`select u.email, u.name, u.role, o.name as org from zt_users u join zt_orgs o on o.id = u.org_id where u.active order by o.name, u.role, u.name`);
    demoAccounts = rows;
  }
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 bg-paper">
      <ThemeStyle theme={theme} />
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <BrandMark theme={theme} orgName={name} size="lg" />
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-bold mb-1">Anmelden</h1>
          <p className="text-sm text-muted mb-5">Kein Passwort nötig: Du bekommst einen Einmalcode per E-Mail.</p>
          <LoginForm orgSlug={org?.slug ?? null} next={searchParams.next ?? null} demoAccounts={demoAccounts} />
        </div>
        <p className="text-xs text-muted text-center mt-6">
          <Link href="/datenschutz" className="underline">
            Datenschutz
          </Link>{' '}
          ·{' '}
          <Link href="/impressum" className="underline">
            Impressum
          </Link>
          {!org && <span> · Zeitly by MALELU</span>}
        </p>
      </div>
    </main>
  );
}
