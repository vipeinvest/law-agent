import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { getDb } from '@/db/client';
import { requireSession, sessionContext } from '@/lib/auth';
import { evaluateUserMonth, prevMonth } from '@/lib/period';
import { isLockedStatus } from '@/lib/repo';
import { toISODate } from '@/domain/time';
import { ABSENCE_LABELS, fmtDateTime, fmtH, fmtMonth, PERIOD_LABELS } from '@/lib/format';
import { Badge, Card, PageHeader, SeverityBadge, Stat } from '@/components/ui';
import { DayList } from '@/components/DayList';
import { PlanAdopt } from '@/components/PlanAdopt';
import { planForDays } from '@/lib/roster';
import { SubmitMonth } from './SubmitMonth';

export const dynamic = 'force-dynamic';

export default async function MonthPage({ searchParams }: { searchParams: { m?: string } }) {
  const s = await requireSession();
  const { employment } = sessionContext(s);
  const db = await getDb();
  const tz = s.org.time_zone;
  const today = toISODate(new Date(), tz);
  const m = /^\d{4}-\d{2}$/.test(searchParams.m ?? '') ? searchParams.m! : today.slice(0, 7);
  const year = Number(m.slice(0, 4));
  const month = Number(m.slice(5, 7));
  const { summary, period, projects } = await evaluateUserMonth(db, s.org, s.user, year, month);
  const [py, pm] = prevMonth(year, month);
  const [ny, nm] = month === 12 ? [year + 1, 1] : [year, month + 1];
  const locked = isLockedStatus(period?.status);
  const monthOver = today > summary.to;
  const status = period?.status ?? 'open';
  const nonInfo = summary.violations.filter((v) => v.severity !== 'info');
  const isCurrent = today >= summary.from && today <= summary.to;
  const balanceToDate = summary.balanceStartMinutes + summary.days.filter((d) => d.date < today).reduce((acc, d) => acc + d.workedMinutes + d.creditMinutes - d.targetMinutes, 0);
  const plan = await planForDays(db, s.org, s.user.id, summary.from, summary.to, summary.days.flatMap((d) => d.entries.map((e) => ({ date: d.date, type: e.type }))));
  const adoptable = Object.values(plan).filter((p) => p.adoptable).length;

  return (
    <div>
      <PageHeader
        title={fmtMonth(year, month)}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Badge tone={status === 'approved' || status === 'exported' ? 'green' : status === 'submitted' ? 'blue' : 'gray'}>{PERIOD_LABELS[status]}</Badge>
            {period?.submitted_at && <span>eingereicht {fmtDateTime(period.submitted_at, tz)}</span>}
          </span>
        }
        action={
          <div className="flex items-center gap-1">
            <Link className="btn-ghost btn-sm" href={`/app/monat?m=${py}-${String(pm).padStart(2, '0')}`} aria-label="Voriger Monat">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link className="btn-ghost btn-sm" href={`/app/monat?m=${ny}-${String(nm).padStart(2, '0')}`} aria-label="Nächster Monat">
              <ChevronRight className="w-5 h-5" />
            </Link>
            <a className="btn-secondary btn-sm" href={`/api/export/journal?year=${year}&month=${month}`}>
              <Download className="w-4 h-4" /> PDF
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Soll" value={fmtH(summary.targetMinutes)} />
        <Stat label="Ist" value={fmtH(summary.workedMinutes)} hint={summary.creditMinutes ? `+ ${fmtH(summary.creditMinutes)} Gutschrift` : undefined} />
        {isCurrent ? (
          <Stat label="Saldo bis gestern" value={fmtH(balanceToDate, true)} hint={`Start ${fmtH(summary.balanceStartMinutes, true)}`} tone={balanceToDate < 0 ? 'bad' : 'good'} />
        ) : (
          <Stat label="Saldo Monatsende" value={fmtH(summary.balanceEndMinutes, true)} hint={`Start ${fmtH(summary.balanceStartMinutes, true)}`} tone={summary.balanceEndMinutes < 0 ? 'bad' : 'good'} />
        )}
        <Stat label="Überstunden" value={fmtH(summary.overtimeMinutes)} hint={summary.mehrarbeitMinutes ? `Mehrarbeit ${fmtH(summary.mehrarbeitMinutes)}` : employment.allIn ? 'All-in: abgegolten' : undefined} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card title="Abwesenheiten & Feiertage">
          <dl className="text-sm grid grid-cols-2 gap-y-1">
            {Object.entries(summary.absenceDays)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{ABSENCE_LABELS[k]}</dt>
                  <dd className="text-right font-medium">{n} Tage</dd>
                </div>
              ))}
            <dt className="text-muted">Feiertage</dt>
            <dd className="text-right font-medium">{summary.holidayDays} Tage</dd>
            <dt className="text-muted">Arbeitstage gebucht</dt>
            <dd className="text-right font-medium">{summary.workedDays}</dd>
            <dt className="text-muted">Reine Telearbeitstage</dt>
            <dd className="text-right font-medium">{summary.remoteOnlyDays}</dd>
            {summary.nightMinutes > 0 && (
              <>
                <dt className="text-muted">Nachtstunden</dt>
                <dd className="text-right font-medium">{fmtH(summary.nightMinutes)}</dd>
              </>
            )}
          </dl>
        </Card>
        <Card title={`Prüfung (${nonInfo.length})`}>
          {nonInfo.length === 0 ? (
            <p className="text-sm text-emerald-700">Keine Auffälligkeiten – alle Buchungen entsprechen den eingestellten Regeln.</p>
          ) : (
            <ul className="space-y-1.5 text-sm max-h-56 overflow-auto">
              {nonInfo.map((v, i) => (
                <li key={i} className="flex items-start gap-2">
                  <SeverityBadge severity={v.severity} />
                  <span>
                    <a href={`#${v.date}`} className="font-medium tabular-nums">
                      {v.date.slice(8, 10)}.{v.date.slice(5, 7)}.
                    </a>{' '}
                    {v.message} <span className="text-muted">({v.legalRef})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {(status === 'open' || status === 'reopened') && (
        <SubmitMonth year={year} month={month} monthOver={monthOver} hasBlocking={summary.violations.some((v) => v.code === 'ENTRY_OPEN' || v.code === 'ENTRY_OVERLAP')} errorCount={summary.errorCount} />
      )}

      <div className="flex items-center justify-between gap-3 mt-6 mb-2">
        <h2 className="font-semibold">Tage</h2>
        {adoptable > 0 && !locked && <PlanAdopt from={summary.from} to={summary.to < today ? summary.to : today} label={`${adoptable} geplante Tage übernehmen`} small />}
      </div>
      <DayList days={summary.days} projects={projects} recordMode={employment.recordMode} timeZone={tz} locked={locked} today={today} compact plan={plan} />
    </div>
  );
}
