import { getDb } from '@/db/client';
import { requireSession, sessionContext } from '@/lib/auth';
import { listAbsences } from '@/lib/repo';
import { evaluateUserMonth } from '@/lib/period';
import { addDays, toISODate } from '@/domain/time';
import { ABSENCE_LABELS, fmtDate } from '@/lib/format';
import { Badge, Card, PageHeader, Stat } from '@/components/ui';
import { AbsenceForm, AbsenceRowActions } from './AbsenceForm';

export const dynamic = 'force-dynamic';

export default async function AbsencesPage() {
  const s = await requireSession();
  const { employment } = sessionContext(s);
  const db = await getDb();
  const tz = s.org.time_zone;
  const today = toISODate(new Date(), tz);
  const year = Number(today.slice(0, 4));
  const rows = await listAbsences(db, s.org.id, s.user.id, `${year - 1}-01-01`, addDays(today, 400));
  // vacation taken this year (approved, work days) – approximate by evaluating months Jan..now
  let vacationTaken = 0;
  let sickDays = 0;
  for (let m = 1; m <= Number(today.slice(5, 7)); m++) {
    const { summary } = await evaluateUserMonth(db, s.org, s.user, year, m);
    vacationTaken += summary.absenceDays.vacation;
    sickDays += summary.absenceDays.sick;
  }
  const planned = rows.filter((r) => r.type === 'vacation' && r.status !== 'rejected' && r.date_from > today && r.date_from.startsWith(String(year))).reduce((a, r) => a + spanDays(r.date_from, r.date_to, r.half_day), 0);
  const upcoming = rows.filter((r) => r.date_to >= today).sort((a, b) => (a.date_from < b.date_from ? -1 : 1));
  const past = rows.filter((r) => r.date_to < today).sort((a, b) => (a.date_from > b.date_from ? -1 : 1)).slice(0, 30);
  return (
    <div>
      <PageHeader title="Abwesenheiten" subtitle="Urlaub beantragen, Krankenstand melden, Zeitausgleich nehmen" />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Urlaub genommen" value={`${vacationTaken}`} hint={`von ${employment.vacationDaysPerYear} Tagen ${year}`} />
        <Stat label="Urlaub geplant" value={`${planned}`} hint="genehmigt/beantragt" />
        <Stat label="Krankenstand" value={`${sickDays}`} hint={`Tage ${year}`} />
      </div>
      <Card title="Neue Abwesenheit" className="mb-4">
        <AbsenceForm today={today} />
      </Card>
      <Card title="Bevorstehend & laufend" className="mb-4">
        <AbsenceTable rows={upcoming} canCancel />
      </Card>
      <Card title="Vergangen">
        <AbsenceTable rows={past} />
      </Card>
    </div>
  );
}

function spanDays(from: string, to: string, half: boolean): number {
  if (half) return 0.5;
  let n = 0;
  let d = from;
  while (d <= to) {
    const wd = new Date(d + 'T00:00:00Z').getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
    d = addDays(d, 1);
  }
  return n;
}

function AbsenceTable({ rows, canCancel }: { rows: Array<{ id: string; date_from: string; date_to: string; type: string; half_day: boolean; status: string; note: string | null }>; canCancel?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Keine Einträge.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
          <div>
            <div className="font-medium">
              {ABSENCE_LABELS[r.type]}
              {r.half_day ? ' (halber Tag)' : ''}
            </div>
            <div className="text-xs text-muted">
              {r.date_from === r.date_to ? fmtDate(r.date_from, { weekday: true }) : `${fmtDate(r.date_from, { weekday: true })} – ${fmtDate(r.date_to, { weekday: true })}`}
              {r.note && ` · ${r.note}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status === 'approved' ? 'Genehmigt' : r.status === 'rejected' ? 'Abgelehnt' : 'Beantragt'}</Badge>
            {canCancel && r.status === 'requested' && <AbsenceRowActions id={r.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
