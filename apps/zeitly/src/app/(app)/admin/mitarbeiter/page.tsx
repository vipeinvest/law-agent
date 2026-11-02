import Link from 'next/link';
import { getDb } from '@/db/client';
import { requireSession, sessionContext } from '@/lib/auth';
import { listUsers } from '@/lib/repo';
import { onboardingOverview } from '@/lib/repo-v2';
import { userEmployment } from '@/lib/org';
import { fmtDateTime, fmtH, ROLE_LABELS } from '@/lib/format';
import { Badge, Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  const s = await requireSession('admin');
  const { rules } = sessionContext(s);
  const db = await getDb();
  const users = await listUsers(db, s.org.id, { includeInactive: true });
  const ob = await onboardingOverview(db, s.org.id);
  return (
    <div>
      <PageHeader title="Mitarbeiter:innen" subtitle={`${users.filter((u) => u.active).length} aktiv`} action={<Link href="/admin/mitarbeiter/neu" className="btn-primary btn-sm">+ Einladen</Link>} />
      <Card padded={false}>
        <div className="overflow-x-auto p-2">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rolle</th>
                <th>Modell</th>
                <th className="text-right">Wo-Std</th>
                <th>Onboarding</th>
                <th>Letzte Anmeldung</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const e = userEmployment(u, rules);
                return (
                  <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                    <td>
                      <Link href={`/admin/mitarbeiter/${u.id}`} className="font-medium hover:underline">
                        {u.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {u.email}
                        {u.personnel_no ? ` · ${u.personnel_no}` : ''}
                      </div>
                    </td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td className="text-xs">
                      {e.recordMode === 'full' ? 'Beginn/Ende' : 'Nur Dauer'}
                      {e.gleitzeit ? ' · Gleitzeit' : ''}
                      {e.allIn ? ' · All-in' : ''}
                      {e.azgExempt ? ' · AZG-ausgenommen' : ''}
                    </td>
                    <td className="text-right tabular-nums">{u.role === 'payroll' ? '–' : fmtH(e.weeklyMinutes)}</td>
                    <td className="text-xs">{(() => {
                      const o = ob.find((x) => x.user_id === u.id);
                      if (u.role === 'payroll') return <span className="text-muted">–</span>;
                      if (!o?.status) return <Link href={`/admin/mitarbeiter/${u.id}?tab=onboarding`} className="underline text-muted">nicht gestartet</Link>;
                      if (o.sent_to_payroll_at) return <Badge tone="green">an LV gesendet</Badge>;
                      if (o.reviewed_at) return <Badge tone="green">geprüft</Badge>;
                      if (o.status === 'submitted') return <Link href={`/admin/mitarbeiter/${u.id}?tab=onboarding`}><Badge tone="blue">eingereicht – prüfen</Badge></Link>;
                      if (o.status === 'expired') return <Badge tone="red">Link abgelaufen</Badge>;
                      return <Badge tone="amber">{o.status === 'opened' ? `offen (${o.completeness ?? 0} %)` : 'Link gesendet'}</Badge>;
                    })()}</td>
                    <td className="text-xs text-muted">{u.last_login_at ? fmtDateTime(u.last_login_at, s.org.time_zone) : u.invited_at ? 'eingeladen' : '–'}</td>
                    <td>{u.active ? <Badge tone="green">aktiv</Badge> : <Badge tone="gray">deaktiviert</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
