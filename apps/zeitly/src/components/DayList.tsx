'use client';
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import clsx from 'clsx';
import { EntryForm, type EntryFormValue } from './EntryForm';
import { Badge, SeverityBadge } from './ui';
import { ABSENCE_LABELS, fmtDate, fmtH, fmtTime, LOCATION_LABELS, TYPE_LABELS, WEEKDAYS_SHORT } from '@/lib/format';
import { formatMinutes } from '@/domain/time';

export interface DayView {
  date: string;
  weekday: number;
  isHoliday: boolean;
  holidayName?: string;
  isWorkDay: boolean;
  targetMinutes: number;
  workedMinutes: number;
  breakMinutes: number;
  creditMinutes: number;
  timeCompMinutes: number;
  absenceType?: string;
  absencePortion?: number;
  entries: Array<{ id: string; startAt: string | null; endAt: string | null; breakMinutes: number; durationMinutes: number | null; type: 'work' | 'travel' | 'oncall'; location: 'office' | 'remote' | 'field'; projectId: string | null; note: string | null; source: string }>;
  violations: Array<{ code: string; severity: 'error' | 'warn' | 'info'; message: string }>;
}

export function DayList({ days, projects, recordMode, timeZone, locked, today, userId, compact }: { days: DayView[]; projects: Array<{ id: string; code: string; name: string; color: string | null }>; recordMode: 'full' | 'duration_only'; timeZone: string; locked: boolean; today: string; userId?: string; compact?: boolean }) {
  const [editing, setEditing] = useState<EntryFormValue | null>(null);
  const toTime = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso));

  return (
    <div className="space-y-2">
      {days.map((d) => {
        const diff = d.workedMinutes + d.creditMinutes - d.targetMinutes;
        const isToday = d.date === today;
        const isFuture = d.date > today;
        return (
          <section key={d.date} className={clsx('card', compact ? 'p-3' : 'p-4', isToday && 'ring-2 ring-brand/30', !d.isWorkDay && !d.entries.length && 'opacity-75')} id={d.date}>
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={clsx('w-10 h-10 rounded-xl flex flex-col items-center justify-center text-xs font-bold shrink-0', isToday ? 'bg-brand text-brand-fg' : 'bg-brand-soft text-brand')}>
                  <span>{WEEKDAYS_SHORT[d.weekday - 1]}</span>
                  <span className="text-[13px] leading-none">{Number(d.date.slice(8, 10))}</span>
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {fmtDate(d.date, { year: false })}
                    {d.isHoliday && <Badge tone="blue" className="ml-2">{d.holidayName}</Badge>}
                    {d.absenceType && (
                      <Badge tone="brand" className="ml-2">
                        {ABSENCE_LABELS[d.absenceType]}
                        {d.absencePortion === 0.5 ? ' (½)' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted tabular-nums">
                    Ist {fmtH(d.workedMinutes)} · Soll {fmtH(d.targetMinutes)}
                    {d.creditMinutes > 0 && ` · Gutschrift ${fmtH(d.creditMinutes)}`}
                    {d.timeCompMinutes > 0 && ` · ZA ${fmtH(d.timeCompMinutes)}`}
                    {d.breakMinutes > 0 && ` · Pause ${d.breakMinutes} min`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(d.isWorkDay || d.workedMinutes > 0) && !isFuture && <span className={clsx('text-sm font-semibold tabular-nums', diff < 0 ? 'text-red-700' : diff > 0 ? 'text-emerald-700' : 'text-muted')}>{formatMinutes(diff, { sign: true })}</span>}
                {!locked && !isFuture && (
                  <button className="btn-ghost btn-sm" aria-label="Buchung hinzufügen" onClick={() => setEditing({ date: d.date, start: '', end: '', breakMinutes: 0, durationMinutes: null, type: 'work', location: 'office', projectId: null, note: '' })}>
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </header>
            {d.entries.length > 0 && (
              <ul className="mt-2 divide-y divide-line">
                {d.entries.map((e) => {
                  const proj = projects.find((p) => p.id === e.projectId);
                  return (
                    <li key={e.id} className="py-1.5 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium tabular-nums">{e.startAt ? `${fmtTime(e.startAt, timeZone)} – ${e.endAt ? fmtTime(e.endAt, timeZone) : '…'}` : `${formatMinutes(e.durationMinutes ?? 0)} h`}</span>
                        <span className="text-muted">
                          {' '}
                          · {e.type !== 'work' ? TYPE_LABELS[e.type] + ' · ' : ''}
                          {LOCATION_LABELS[e.location]}
                          {e.breakMinutes > 0 && ` · Pause ${e.breakMinutes}`}
                        </span>
                        {proj && (
                          <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted">
                            <span className="w-2 h-2 rounded-full" style={{ background: proj.color || '#999' }} />
                            {proj.code}
                          </span>
                        )}
                        {e.note && <div className="text-xs text-muted truncate">{e.note}</div>}
                      </div>
                      {!locked && (
                        <button className="btn-ghost btn-sm" aria-label="Bearbeiten" onClick={() => setEditing({ id: e.id, date: d.date, start: e.startAt ? toTime(e.startAt) : '', end: e.endAt ? toTime(e.endAt) : '', breakMinutes: e.breakMinutes, durationMinutes: e.durationMinutes, type: e.type, location: e.location, projectId: e.projectId, note: e.note ?? '' })}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {d.violations.filter((x) => x.severity !== 'info').length > 0 && (
              <ul className="mt-2 space-y-1">
                {d.violations
                  .filter((x) => x.severity !== 'info')
                  .map((x, i) => (
                    <li key={i} className="text-xs flex items-start gap-2">
                      <SeverityBadge severity={x.severity} /> <span>{x.message}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        );
      })}
      {editing && <EntryForm initial={editing} projects={projects} recordMode={recordMode} userId={userId} onClose={() => setEditing(null)} />}
    </div>
  );
}
