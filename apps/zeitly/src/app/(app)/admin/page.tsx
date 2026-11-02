import Link from 'next/link';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth';
import { evaluateOrgMonth } from '@/lib/export/common';
import { toISODate } from '@/domain/time';
import { fmtH, fmtMonth, fmtTime, LOCATION_LABELS, PERIOD_LABELS } from '@/lib/format';
import { Badge, Card, PageHeader, Stat } from '@/components/ui';
import { prevMonth } from '@/lib/period';

export const dynamic = 'force-dynamic';

export default async function AdminHome({ searchParams }: { searchParams: { m?: string } }) {
  const s = await requireSession();
  const db = await getDb();
  const tz = s.org.time_zone;
  const today = toISODate(new Date(), tz);
  const m = /^\d{4}-\d{2}$/.test(searchParams.m ?? '') ? searchParams.m! : today.slice(0, 7);
  const year = Number(m.slice(0, 4));
  const month = Number(m.slice(5, 7));
  const isCurrent = m === today.slice(0, 7);
  const data = await evaluateOrgMonth(db, s, year, month);
  const { rows: timers } = await db.query<{ user_id: string; name: string; started_at: string; location: string; break_started_at: string | null }>(`select t.user_id, u.name, t.started_at, t.location, t.break_started_at from zt_timers t join zt_users u on u.id = t.user_id where t.org_id = $1 order by t.started_at`, [s.org.id]);
  const { rows: todayDone } = await db.query<{ user_id: string; minutes: number }>(
    `select user_id, sum(coalesce(duration_minutes, extract(epoch from (end_at - start_at))/60 - break_minutes))::int as minutes from zt_time_entries where org_id = $1 and date = $2 and deleted_at is null and end_at is not null group by user_id`,
    [s.org.id, today],
  );
  const [py, pm] = prevMonth(year, month);
  const [ny, nm] = month === 12 ? [year + 1, 1] : [year, month + 1];
  const totals = data.employees.reduce((a, e) => ({ worked: a.worked + e.summary.workedMinutes, target: a.target + e.summary.targetMinutes, ot: a.ot + e.summary.overtimeMinutes, errors: a.errors + e.summary.errorCount }), { worked: 0, target: 0, ot: 0, errors: 0 });
  const openPeriods = data.employees.filter((e) => !e.period || e.period.status === 'open' || e.period.status === 'reopened').length;
  const submitted = data.employees.filter((e) => e.period?.status === 'submitted').length;

  return (
    <div>
      <PageHeader title="Team" subtitle={s.org.name} action={<Link href="/admin/export" className="btn-secondary btn-sm">Export {fmtMonth(py, pm)}</Link>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Jetzt eingestempelt" value={timers.length} hint={`von ${data.employees.length} Mitarbeiter:innen`} />
        <Stat label={`Ist ${isCurrent ? 'bisher' : ''}`} value={fmtH(totals.worked)} hint={`Soll ${fmtH(totals.target)}`} />
        <Stat label="Überstunden" value={fmtH(totals.ot)} hint={fmtMonth(year, month)} />
        <Stat label="Auffälligkeiten" value={totals.errors} tone={totals.errors ? 'warn' : 'good'} hint="Verstöße gegen AZG-Grenzen" />
      </div>

      {timers.length > 0 && (
        <Card title="Gerade aktiv" className="mb-4">
          <ul className="divide-y divide-line text-sm">
            {timers.map((t) => (
              <li key={t.user_id} className="py-1.5 flex items-center justify-between">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted">
                  seit {fmtTime(t.started_at, tz)} · {LOCATION_LABELS[t.location]} {t.break_started_at && <Badge tone="amber">Pause</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title={`Monatsübersicht ${fmtMonth(year, month)}`}
        action={
          <div className="flex items-center gap-1 text-sm">
            <Link className="btn-ghost btn-sm" href={`/admin?m=${py}-${String(pm).padStart(2, '0')}`}>
              ‹
            </Link>
            <Link className="btn-ghost btn-sm" href={`/admin?m=${ny}-${String(nm).padStart(2, '0')}`}>
              ›
            </Link>
          </div>
        }
        padded={false}
      >
        <div className="overflow-x-auto p-2">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th>Mitarbeiter:in</th>
                <th className="text-right">Heute</th>
                <th className="text-right">Ist</th>
                <th className="text-right">Soll</th>
                <th className="text-right">Saldo</th>
                <th className="text-right">ÜSt</th>
                <th className="text-right">Urlaub/KS</th>
                <th className="text-center">Prüfung</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e) => {
                const sum = e.summary;
                const t = todayDone.find((x) => x.user_id === e.user.id)?.minutes ?? 0;
                const bal = isCurrent ? sum.balanceStartMinutes + sum.days.filter((d) => d.date < today).reduce((a, d) => a + d.workedMinutes + d.creditMinutes - d.targetMinutes, 0) : sum.balanceEndMinutes;
                const st = e.period?.status ?? 'open';
                return (
                  <tr key={e.user.id} className="hover:bg-black/[0.02]">
                    <td>
                      <Link href={`/admin/mitarbeiter/${e.user.id}?m=${m}`} className="font-medium hover:underline">
                        {e.user.name}
                      </Link>
                      <div className="text-xs text-muted">{e.user.personnel_no || e.user.email}</div>
                    </td>
                    <td className="text-right tabular-nums">{isCurrent ? fmtH(t) : '–'}</td>
                    <td className="text-right tabular-nums">{fmtH(sum.workedMinutes)}</td>
                    <td className="text-right tabular-nums">{fmtH(sum.targetMinutes)}</td>
                    <td className={`text-right tabular-nums font-medium ${bal < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtH(bal, true)}</td>
                    <td className="text-right tabular-nums">{fmtH(sum.overtimeMinutes)}</td>
                    <td className="text-right tabular-nums">
                      {sum.absenceDays.vacation} / {sum.absenceDays.sick}
                    </td>
                    <td className="text-center">{sum.errorCount ? <Badge tone="red">{sum.errorCount}</Badge> : sum.warnCount ? <Badge tone="amber">{sum.warnCount}</Badge> : <Badge tone="green">ok</Badge>}</td>
                    <td>
                      <Badge tone={st === 'approved' || st === 'exported' ? 'green' : st === 'submitted' ? 'blue' : 'gray'}>{PERIOD_LABELS[st]}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isCurrent && (openPeriods > 0 || submitted > 0) && (
          <div className="px-4 pb-4 text-sm text-muted">
            {submitted > 0 && (
              <span>
                {submitted} eingereicht –{' '}
                <Link href="/admin/freigaben" className="underline">
                  jetzt freigeben
                </Link>
                .{' '}
              </span>
            )}
            {openPeriods > 0 && <span>{openPeriods} Monat(e) noch offen.</span>}
          </div>
        )}
      </Card>
    </div>
  );
}
