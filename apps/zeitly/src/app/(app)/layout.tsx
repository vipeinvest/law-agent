import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireSession, isManagerOrAbove, sessionContext } from '@/lib/auth';
import { getDb } from '@/db/client';
import { ROLE_LABELS } from '@/lib/format';
import { BrandMark, ThemeStyle } from '@/components/theme';
import { BottomNav, SideNav, TopBar } from '@/components/nav';
import { adminNav, employeeNav } from '@/components/nav-items';
import { PwaRegister } from '@/components/pwa';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await requireSession();
  const { theme } = sessionContext(s);
  const pathname = headers().get('x-pathname') || '';
  const inAdmin = pathname.startsWith('/admin');
  const manager = isManagerOrAbove(s.user) || s.user.role === 'payroll';
  let pending = 0;
  if (manager) {
    const db = await getDb();
    const { rows } = await db.query<{ n: number }>(
      `select (select count(*) from zt_periods where org_id = $1 and status = 'submitted')::int + (select count(*) from zt_absences where org_id = $1 and status = 'requested' and deleted_at is null)::int as n`,
      [s.org.id],
    );
    pending = rows[0]?.n ?? 0;
  }
  const items = inAdmin && manager ? adminNav(s.user.role, pending) : employeeNav();
  const switchTo = manager ? (inAdmin ? { href: '/app', label: 'Meine Zeiten' } : { href: '/admin', label: 'Team & Verwaltung' }) : undefined;
  const brand = <BrandMark theme={theme} orgName={s.org.theme?.appName || s.org.name} size="sm" />;
  return (
    <div className="min-h-dvh flex">
      <ThemeStyle theme={theme} />
      <SideNav items={items} brand={brand} user={{ name: s.user.name, email: s.user.email, roleLabel: `${ROLE_LABELS[s.user.role]} · ${s.org.name}` }} switchTo={switchTo} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar brand={brand} right={switchTo ? <a href={switchTo.href} className="text-xs font-semibold text-brand">{switchTo.label}</a> : undefined} />
        <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 pb-24 md:pb-8">{children}</main>
      </div>
      <BottomNav items={items} />
      <PwaRegister />
    </div>
  );
}
