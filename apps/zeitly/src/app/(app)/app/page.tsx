import Link from 'next/link';
import { getDb } from '@/db/client';
import { requireSession, sessionContext } from '@/lib/auth';
import { evaluateUserMonth, prevMonth } from '@/lib/period';
import { getPeriod, getTimer, listProjects } from '@/lib/repo';
import { timerState } from '@/lib/timer';
import { liveHints } from '@/domain/rules';
import { formatMinutes, isoWeekKey, toISODate } from '@/domain/time';
import { fmtDateLong, fmtH, fmtMonth, fmtTime, LOCATION_LABELS, TYPE_LABELS } from '@/lib/format';
import { Badge, Card, SeverityBadge, Stat } from '@/components/ui';
import { TimerCard } from './TimerCard';
import { PlanAdopt } from '@/components/PlanAdopt';
import { planForDays } from '@/lib/roster';
import { addDays } from '@/domain/time';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const s = await requireSession();
  const { rules, employment } = sessionContext(s);
  const db = await getDb();
  const tz = s.org.time_zone;
  const today = toISODate(new Date(), tz);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const [timer, projects, current] = await Promise.all([getTimer(db, s.user.id), listProjects(db, s.org.id), evaluateUserMonth(db, s.org, s.user, year, month)]);
  const [py, pm] = prevMonth(year, month);
  const prevPeriod = await getPeriod(db, s.org.id, s.user.id, py, pm);
  const ts = timerState(timer);
  const day = current.summary.days.find((d) => d.date === today);
  const workedToday = (day?.workedMinutes ?? 0) + ts.elapsedMinutes;
  const breaksToday = (day?.breakMinutes ?? 0) + ts.breakMinutes;
  const hints = liveHints(workedToday, breaksToday, rules, employment.gleitzeit);
  const weekKey = isoWeekKey(today);
  const week = current.summary.weeks.find((w) => w.isoWeek === weekKey);
  const weekWorked = (week?.workedMinutes ?? 0) + ts.elapsedMinutes;
  const weekTarget = week?.targetMinutes ?? employment.weeklyMinutes;
  // balance up to yesterday (today's target is still open)
  const balanceToDate = current.summary.balanceStartMinutes + current.summary.days.filter((d) => d.date < today).reduce((acc, d) => acc + d.workedMinutes + d.creditMinutes - d.targetMinutes, 0);
  const todaysViolations = day?.violations.filter((v) => v.severity !== 'info') ?? [];
  const monthErrors = current.summary.violations.filter((v) => v.severity === 'error');
  const greeting = new Date().getUTCHours() + 1 < 11 ? 'Guten Morgen' : new Date().getUTCHours() + 1 < 17 ? 'Hallo' : 'Guten Abend';
  const plan = await planForDays(db, s.org, s.user.id, addDays(today, -7), addDays(today, 7), current.summary.days.flatMap((d) => d.entries.map((e) => ({ date: d.date, type: e.type }))));
  const todayPlan = plan[today];
  const nextPlanDate = Object.keys(plan).filter((d) => d > today).sort()[0];
  const openPast = Object.entries(plan).filter(([d, p]) => d < today && p.adoptable).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{fmtDateLong(today)}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {s.user.name.split(' ')[0]}
        </h1>
      </div>

      <TimerCard initial={ts} projects={projects.map((p) => ({ id: p.id, code: p.code, name: p.name, color: p.color }))} recordMode={employment.recordMode} todayDate={today} hints={hints} workedTodayMinutes={day?.workedMinutes ?? 0} />

      {(todayPlan || nextPlanDate || openPast > 0) && (
        <Card title="Dienstplan">
          <div className="text-sm space-y-2">
            {todayPlan ? (
              <div className="flex items-center justify-between gap-3">
                <span className="tabular-nums">
                  Heute geplant: <strong>{todayPlan.start} – {todayPlan.end}</strong> · {LOCATION_LABELS[todayPlan.location]}
                  {todayPlan.breakMinutes > 0 && ` · Pause ${todayPlan.breakMinutes} min`}
                  {todayPlan.note && <span className="text-muted"> · {todayPlan.note}</span>}
                </span>
                {todayPlan.adopted ? <Badge tone="green">gebucht</Badge> : todayPlan.adoptable ? <PlanAdopt from={today} small label="Wie geplant übernehmen" /> : <Badge tone="gray">läuft</Badge>}
              </div>
            ) : (
              <p className="text-muted">Heute keine Schicht geplant.</p>
            )}
            {nextPlanDate && plan[nextPlanDate] && (
              <p className="text-muted">
                Nächste Schicht: {fmtDateLong(nextPlanDate)}, {plan[nextPlanDate].start} – {plan[nextPlanDate].end} · {LOCATION_LABELS[plan[nextPlanDate].location]}
              </p>
            )}
            {openPast > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span>
                  {openPast} geplante {openPast === 1 ? 'Tag' : 'Tage'} der letzten Woche ohne Buchung.
                </span>
                <Link href={`/app/woche?d=${addDays(today, -7)}`} className="btn-ghost btn-sm">
                  Ansehen
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Heute" value={fmtH(workedToday)} hint={`Soll ${fmtH(day?.targetMinutes ?? 0)}`} />
        <Stat label="Diese Woche" value={fmtH(weekWorked)} hint={`Soll ${fmtH(weekTarget)}`} tone={weekWorked > rules.maxWeeklyMinutes ? 'bad' : 'default'} />
        <Stat label="Zeitkonto" value={formatMinutes(balanceToDate, { sign: true }) + ' h'} hint="Stand gestern" tone={balanceToDate < -600 ? 'warn' : balanceToDate > 0 ? 'good' : 'default'} />
        <Stat label="Urlaub offen" value={`${Math.max(0, employment.vacationDaysPerYear - current.summary.absenceDays.vacation).toFixed(1).replace('.0', '')} T`} hint={`Anspruch ${employment.vacationDaysPerYear} Tage/Jahr`} />
      </div>

      {(todaysViolations.length > 0 || monthErrors.length > 0 || (prevPeriod?.status ?? 'open') === 'open' || !prevPeriod) && (
        <Card title="Zu erledigen">
          <ul className="space-y-2 text-sm">
            {!prevPeriod || prevPeriod.status === 'open' || prevPeriod.status === 'reopened' ? (
              <li className="flex items-center justify-between gap-3">
                <span>
                  Monat <strong>{fmtMonth(py, pm)}</strong> noch nicht abgeschlossen.
                </span>
                <Link href={`/app/monat?m=${py}-${String(pm).padStart(2, '0')}`} className="btn-secondary btn-sm">
                  Prüfen & einreichen
                </Link>
              </li>
            ) : null}
            {todaysViolations.map((v, i) => (
              <li key={i} className="flex items-start gap-2">
                <SeverityBadge severity={v.severity} />
                <span>{v.message}</span>
              </li>
            ))}
            {monthErrors.length > 0 && (
              <li className="flex items-center justify-between gap-3">
                <span>
                  {monthErrors.length} offene {monthErrors.length === 1 ? 'Auffälligkeit' : 'Auffälligkeiten'} im {fmtMonth(year, month)}.
                </span>
                <Link href="/app/monat" className="btn-ghost btn-sm">
                  Ansehen
                </Link>
              </li>
            )}
          </ul>
        </Card>
      )}

      <Card
        title="Heute gebucht"
        action={
          <Link href={`/app/woche?d=${today}#neu`} className="btn-ghost btn-sm">
            + Nachtragen
          </Link>
        }
      >
        {!day || day.entries.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Buchung heute.</p>
        ) : (
          <ul className="divide-y divide-line">
            {day.entries.map((e) => {
              const proj = projects.find((p) => p.id === e.projectId);
              return (
                <li key={e.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium tabular-nums">
                      {e.startAt ? `${fmtTime(e.startAt, tz)} – ${e.endAt ? fmtTime(e.endAt, tz) : '…'}` : `${formatMinutes(e.durationMinutes ?? 0)} h`}
                      {e.breakMinutes > 0 && <span className="text-muted font-normal"> · Pause {e.breakMinutes} min</span>}
                    </div>
                    <div className="text-xs text-muted flex gap-2 flex-wrap">
                      <span>{TYPE_LABELS[e.type]}</span>
                      <span>· {LOCATION_LABELS[e.location]}</span>
                      {proj && (
                        <span className="inline-flex items-center gap-1">
                          · <span className="w-2 h-2 rounded-full" style={{ background: proj.color || '#999' }} /> {proj.code}
                        </span>
                      )}
                      {e.note && <span>· {e.note}</span>}
                    </div>
                  </div>
                  <Badge tone="gray">{e.source === 'timer' ? 'Stempel' : e.source === 'import' ? 'Import' : e.source === 'plan' ? 'Plan' : 'Manuell'}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
