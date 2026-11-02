import Link from 'next/link';
import { getDb } from '@/db/client';
import { requireSession, hasRole } from '@/lib/auth';
import { visibleUsers, type PeriodRow } from '@/lib/repo';
import { evaluateOrgMonth } from '@/lib/export/common';
import { toISODate } from '@/domain/time';
import { prevMonth } from '@/lib/period';
import { ABSENCE_LABELS, fmtDate, fmtDateTime, fmtH, fmtMonth } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { AbsenceDecision, PeriodActions } from './Actions';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const s = await requireSession('manager');
  const db = await getDb();
  const tz = s.org.time_zone;
  const today = toISODate(new Date(), tz);
  const users = await visibleUsers(db, s.user);
  const userIds = users.map((u) => u.id);
  const { rows: submitted } = await db.query<PeriodRow & { name: string; personnel_no: string | null }>(
    `select p.*, u.name, u.personnel_no from zt_periods p join zt_users u on u.id = p.user_id where p.org_id = $1 and p.status = 'submitted' and p.user_id = any($2::uuid[]) order by p.year, p.month, u.name`,
    [s.org.id, userIds],
  );
  const { rows: requests } = await db.query<{ id: string; user_id: string; name: string; date_from: string; date_to: string; type: string; half_day: boolean; note: string | null; created_at: string }>(
    `select a.id, a.user_id, u.name, a.date_from, a.date_to, a.type, a.half_day, a.note, a.created_at from zt_absences a join zt_users u on u.id = a.user_id where a.org_id = $1 and a.status = 'requested' and a.deleted_at is null and a.user_id = any($2::uuid[]) order by a.date_from`,
    [s.org.id, userIds],
  );
  // previous month: who has not submitted yet
  const [py, pm] = prevMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  const prev = await evaluateOrgMonth(db, s, py, pm);
  const notSubmitted = prev.employees.filter((e) => !e.period || e.period.status === 'open' || e.period.status === 'reopened');
  const recent = await db.query<PeriodRow & { name: string }>(`select p.*, u.name from zt_periods p join zt_users u on u.id = p.user_id where p.org_id = $1 and p.status in ('approved','exported') and p.user_id = any($2::uuid[]) order by p.approved_at desc nulls last limit 12`, [s.org.id, userIds]);

  return (
    <div>
      <PageHeader title="Freigaben" subtitle="Monatsabschlüsse und Abwesenheitsanträge" />
      <Card title={`Eingereichte Monate (${submitted.length})`} className="mb-4">
        {submitted.length === 0 ? (
          <p className="text-sm text-muted">Nichts zu prüfen.</p>
        ) : (
          <ul className="divide-y divide-line">
            {submitted.map((p) => {
              const sum = p.summary as Record<string, number>;
              return (
                <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">
                      {p.name} · {fmtMonth(p.year, p.month)}
                    </div>
                    <div className="text-muted">
                      Ist {fmtH(sum.workedMinutes ?? 0)} · Soll {fmtH(sum.targetMinutes ?? 0)} · ÜSt {fmtH(sum.overtimeMinutes ?? 0)} · Saldo {fmtH(p.balance_end, true)}
                      {(sum.errorCount ?? 0) > 0 && (
                        <Badge tone="red" className="ml-2">
                          {sum.errorCount} Verstöße
                        </Badge>
                      )}
                    </div>
                    {p.employee_note && <div className="text-xs mt-1 bg-amber-50 rounded px-2 py-1">Anmerkung: {p.employee_note}</div>}
                    <div className="text-xs text-muted">eingereicht {fmtDateTime(p.submitted_at, tz)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link className="btn-ghost btn-sm" href={`/admin/mitarbeiter/${p.user_id}?m=${p.year}-${String(p.month).padStart(2, '0')}`}>
                      Prüfen
                    </Link>
                    <a className="btn-ghost btn-sm" href={`/api/export/journal?year=${p.year}&month=${p.month}&userId=${p.user_id}&inline=1`} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                    <PeriodActions userId={p.user_id} year={p.year} month={p.month} canReopen={hasRole(s.user, 'admin')} status={p.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={`Abwesenheitsanträge (${requests.length})`} className="mb-4">
        {requests.length === 0 ? (
          <p className="text-sm text-muted">Keine offenen Anträge.</p>
        ) : (
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-semibold">
                    {r.name} · {ABSENCE_LABELS[r.type]}
                    {r.half_day ? ' (½ Tag)' : ''}
                  </div>
                  <div className="text-muted">
                    {r.date_from === r.date_to ? fmtDate(r.date_from, { weekday: true }) : `${fmtDate(r.date_from, { weekday: true })} – ${fmtDate(r.date_to, { weekday: true })}`}
                    {r.note && ` · ${r.note}`}
                  </div>
                </div>
                <AbsenceDecision id={r.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Noch nicht eingereicht: ${fmtMonth(py, pm)} (${notSubmitted.length})`} className="mb-4">
        {notSubmitted.length === 0 ? (
          <p className="text-sm text-emerald-700">Alle Monate liegen vor.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {notSubmitted.map((e) => (
              <li key={e.user.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{e.user.name}</span>
                  <span className="text-muted">
                    {' '}
                    · Ist {fmtH(e.summary.workedMinutes)} · {e.summary.errorCount ? `${e.summary.errorCount} Verstöße` : 'keine Verstöße'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link className="btn-ghost btn-sm" href={`/admin/mitarbeiter/${e.user.id}?m=${py}-${String(pm).padStart(2, '0')}`}>
                    Öffnen
                  </Link>
                  <PeriodActions userId={e.user.id} year={py} month={pm} canReopen={false} status="open" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Zuletzt freigegeben">
        {recent.rows.length === 0 ? (
          <EmptyState title="Noch keine Freigaben" />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {recent.rows.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <span>
                  {p.name} · {fmtMonth(p.year, p.month)} <span className="text-muted">· Saldo {fmtH(p.balance_end, true)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge tone="green">{p.status === 'exported' ? 'Exportiert' : 'Freigegeben'}</Badge>
                  {hasRole(s.user, 'admin') && <PeriodActions userId={p.user_id} year={p.year} month={p.month} canReopen status={p.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
