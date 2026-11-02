import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDb } from '@/db/client';
import { requireSession, sessionContext } from '@/lib/auth';
import { evaluateUserMonth } from '@/lib/period';
import { getPeriod, isLockedStatus, listProjects } from '@/lib/repo';
import { addDays, isoWeekKey, toISODate, weekStart } from '@/domain/time';
import { fmtDate, fmtH } from '@/lib/format';
import { PageHeader, Stat } from '@/components/ui';
import { DayList } from '@/components/DayList';
import { PlanAdopt } from '@/components/PlanAdopt';
import { planForDays } from '@/lib/roster';

export const dynamic = 'force-dynamic';

export default async function WeekPage({ searchParams }: { searchParams: { d?: string } }) {
  const s = await requireSession();
  const { employment, rules } = sessionContext(s);
  const db = await getDb();
  const tz = s.org.time_zone;
  const today = toISODate(new Date(), tz);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? '') ? searchParams.d! : today;
  const monday = weekStart(anchor);
  const sunday = addDays(monday, 6);
  const months = new Set([monday.slice(0, 7), sunday.slice(0, 7)]);
  const evals = await Promise.all(Array.from(months).map((ym) => evaluateUserMonth(db, s.org, s.user, Number(ym.slice(0, 4)), Number(ym.slice(5, 7)))));
  const days = evals.flatMap((e) => e.summary.days).filter((d) => d.date >= monday && d.date <= sunday).sort((a, b) => (a.date < b.date ? -1 : 1));
  const projects = await listProjects(db, s.org.id, false);
  const lockedMonths = await Promise.all(Array.from(months).map(async (ym) => isLockedStatus((await getPeriod(db, s.org.id, s.user.id, Number(ym.slice(0, 4)), Number(ym.slice(5, 7))))?.status)));
  const locked = lockedMonths.some(Boolean);
  const worked = days.reduce((a, d) => a + d.workedMinutes, 0);
  const target = days.reduce((a, d) => a + d.targetMinutes, 0);
  const credit = days.reduce((a, d) => a + d.creditMinutes, 0);
  const weekViolations = evals.flatMap((e) => e.summary.weeks).find((w) => w.isoWeek === isoWeekKey(monday))?.violations ?? [];
  const plan = await planForDays(db, s.org, s.user.id, monday, sunday, days.flatMap((d) => d.entries.map((e) => ({ date: d.date, type: e.type }))));
  const adoptable = Object.values(plan).filter((p) => p.adoptable).length;
  const planned = Object.values(plan).reduce((a, p) => a + Math.max(0, (Number(p.end.slice(0, 2)) * 60 + Number(p.end.slice(3)) - Number(p.start.slice(0, 2)) * 60 - Number(p.start.slice(3)) + 1440) % 1440 - p.breakMinutes), 0);

  return (
    <div>
      <PageHeader
        title={`Woche ${isoWeekKey(monday).slice(6)}`}
        subtitle={`${fmtDate(monday)} – ${fmtDate(sunday)}`}
        action={
          <div className="flex items-center gap-1">
            <Link className="btn-ghost btn-sm" href={`/app/woche?d=${addDays(monday, -7)}`} aria-label="Vorige Woche">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link className="btn-ghost btn-sm" href="/app/woche">
              Heute
            </Link>
            <Link className="btn-ghost btn-sm" href={`/app/woche?d=${addDays(monday, 7)}`} aria-label="Nächste Woche">
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Ist" value={fmtH(worked)} hint={credit ? `+ ${fmtH(credit)} Gutschrift` : undefined} />
        <Stat label="Soll" value={fmtH(target)} hint={planned ? `Dienstplan ${fmtH(planned)}` : undefined} />
        <Stat label="Differenz" value={fmtH(worked + credit - target, true)} tone={worked + credit - target < 0 ? 'bad' : 'good'} />
      </div>
      {worked > rules.maxWeeklyMinutes && <p className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">Die Wochenarbeitszeit überschreitet die gesetzliche Höchstgrenze von {fmtH(rules.maxWeeklyMinutes)} (AZG § 9).</p>}
      {weekViolations.map((v, i) => (
        <p key={i} className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {v.message} <span className="text-muted">({v.legalRef})</span>
        </p>
      ))}
      {locked && <p className="mb-3 text-sm text-muted bg-gray-50 border border-line rounded-lg p-3">Dieser Zeitraum ist eingereicht oder freigegeben und kann nicht mehr bearbeitet werden.</p>}
      {adoptable > 1 && !locked && (
        <div className="mb-3 flex items-center justify-between gap-3 text-sm bg-brand-soft border border-brand/20 rounded-lg p-3">
          <span>
            {adoptable} geplante Tage ohne Buchung. Alles wie geplant gelaufen? Dann mit einem Tipp übernehmen – Abweichungen bitte einzeln nachtragen.
          </span>
          <PlanAdopt from={monday} to={sunday} label="Woche wie geplant übernehmen" small />
        </div>
      )}
      <DayList days={days} projects={projects} recordMode={employment.recordMode} timeZone={tz} locked={locked} today={today} plan={plan} />
    </div>
  );
}
