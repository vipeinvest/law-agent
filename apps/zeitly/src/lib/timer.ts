import 'server-only';
import type { DbClient } from '@/db/client';
import { ApiError } from './api';
import { audit, type AuditActor } from './audit';
import type { Session } from './auth';
import { getTimer, insertEntry, type TimerRow } from './repo';
import { assertPeriodEditable } from './entries';
import { localDateTimeToInstant, minutesBetween, addDays, toISODate } from '@/domain/time';
import type { EntryLocation, EntryType } from '@/domain/types';

export interface TimerState {
  running: boolean;
  startedAt: string | null;
  onBreak: boolean;
  breakStartedAt: string | null;
  breakMinutes: number;
  type: EntryType;
  location: EntryLocation;
  projectId: string | null;
  note: string | null;
  /** net minutes so far (excluding breaks) */
  elapsedMinutes: number;
}

export function timerState(t: TimerRow | null, now = new Date()): TimerState {
  if (!t) return { running: false, startedAt: null, onBreak: false, breakStartedAt: null, breakMinutes: 0, type: 'work', location: 'office', projectId: null, note: null, elapsedMinutes: 0 };
  const gross = Math.max(0, Math.round((now.getTime() - new Date(t.started_at).getTime()) / 60000));
  const liveBreak = t.break_started_at ? Math.max(0, Math.round((now.getTime() - new Date(t.break_started_at).getTime()) / 60000)) : 0;
  const breaks = t.break_minutes + liveBreak;
  return {
    running: true,
    startedAt: t.started_at,
    onBreak: !!t.break_started_at,
    breakStartedAt: t.break_started_at,
    breakMinutes: breaks,
    type: t.type,
    location: t.location,
    projectId: t.project_id,
    note: t.note,
    elapsedMinutes: Math.max(0, gross - breaks),
  };
}

export async function startTimer(db: DbClient, s: Session, actor: AuditActor, opts: { type: EntryType; location: EntryLocation; projectId: string | null; note: string | null; at?: string }): Promise<TimerState> {
  const existing = await getTimer(db, s.user.id);
  if (existing) throw new ApiError(409, 'Es läuft bereits eine Zeiterfassung.');
  const startedAt = clampAt(opts.at);
  await assertPeriodEditable(db, s, s.user.id, toISODate(startedAt, s.org.time_zone));
  await db.query(`insert into zt_timers (user_id, org_id, started_at, type, location, project_id, note) values ($1,$2,$3,$4,$5,$6,$7)`, [s.user.id, s.org.id, startedAt, opts.type, opts.location, opts.projectId, opts.note]);
  await audit(db, actor, s.org.id, 'timer.start', 'timer', s.user.id, null, { startedAt, ...opts });
  return timerState(await getTimer(db, s.user.id));
}

export async function updateTimer(db: DbClient, s: Session, actor: AuditActor, patch: { location?: EntryLocation; projectId?: string | null; note?: string | null; type?: EntryType }): Promise<TimerState> {
  const t = await getTimer(db, s.user.id);
  if (!t) throw new ApiError(409, 'Keine laufende Zeiterfassung.');
  await db.query(
    `update zt_timers set location = coalesce($2, location), project_id = case when $3::boolean then $4::uuid else project_id end, note = case when $5::boolean then $6 else note end, type = coalesce($7, type), updated_at = now() where user_id = $1`,
    [s.user.id, patch.location ?? null, patch.projectId !== undefined, patch.projectId ?? null, patch.note !== undefined, patch.note ?? null, patch.type ?? null],
  );
  await audit(db, actor, s.org.id, 'timer.update', 'timer', s.user.id, t, patch);
  return timerState(await getTimer(db, s.user.id));
}

export async function breakTimer(db: DbClient, s: Session, actor: AuditActor, action: 'start' | 'end', at?: string): Promise<TimerState> {
  const t = await getTimer(db, s.user.id);
  if (!t) throw new ApiError(409, 'Keine laufende Zeiterfassung.');
  const now = clampAt(at);
  if (action === 'start') {
    if (t.break_started_at) throw new ApiError(409, 'Pause läuft bereits.');
    await db.query(`update zt_timers set break_started_at = $2, updated_at = now() where user_id = $1`, [s.user.id, now]);
  } else {
    if (!t.break_started_at) throw new ApiError(409, 'Keine Pause aktiv.');
    const add = Math.max(0, minutesBetween(t.break_started_at, now));
    await db.query(`update zt_timers set break_started_at = null, break_minutes = break_minutes + $2, updated_at = now() where user_id = $1`, [s.user.id, add]);
  }
  await audit(db, actor, s.org.id, `timer.break_${action}`, 'timer', s.user.id, null, { at: now });
  return timerState(await getTimer(db, s.user.id));
}

/** Stop → one or two time entries (split at local midnight). */
export async function stopTimer(db: DbClient, s: Session, actor: AuditActor, at?: string, finalNote?: string | null): Promise<{ entryIds: string[] }> {
  const t = await getTimer(db, s.user.id);
  if (!t) throw new ApiError(409, 'Keine laufende Zeiterfassung.');
  const endAt = clampAt(at);
  if (endAt <= t.started_at) throw new ApiError(400, 'Ende liegt vor dem Beginn.');
  let breakMinutes = t.break_minutes;
  if (t.break_started_at) breakMinutes += Math.max(0, minutesBetween(t.break_started_at, endAt));
  const tz = s.org.time_zone;
  const startDate = toISODate(t.started_at, tz);
  const endDate = toISODate(endAt, tz);
  const note = finalNote !== undefined ? finalNote : t.note;
  const base = { type: t.type, location: t.location, projectId: t.project_id, note, source: 'timer' as const, durationMinutes: null };
  const ids: string[] = [];
  if (startDate === endDate || minutesBetween(t.started_at, endAt) <= 1) {
    const row = await insertEntry(db, s.org.id, s.user.id, s.user.id, { ...base, date: startDate, startAt: t.started_at, endAt, breakMinutes });
    ids.push(row.id);
  } else {
    // split at midnight of the following day; breaks are attributed to the first part
    const midnight = localDateTimeToInstant(addDays(startDate, 1), '00:00', tz);
    const first = await insertEntry(db, s.org.id, s.user.id, s.user.id, { ...base, date: startDate, startAt: t.started_at, endAt: midnight, breakMinutes: Math.min(breakMinutes, minutesBetween(t.started_at, midnight)) });
    const second = await insertEntry(db, s.org.id, s.user.id, s.user.id, { ...base, date: endDate, startAt: midnight, endAt, breakMinutes: Math.max(0, breakMinutes - minutesBetween(t.started_at, midnight)) });
    ids.push(first.id, second.id);
  }
  await db.query(`delete from zt_timers where user_id = $1`, [s.user.id]);
  await audit(db, actor, s.org.id, 'timer.stop', 'timer', s.user.id, t, { endAt, entryIds: ids });
  return { entryIds: ids };
}

export async function discardTimer(db: DbClient, s: Session, actor: AuditActor): Promise<void> {
  const t = await getTimer(db, s.user.id);
  if (!t) return;
  await db.query(`delete from zt_timers where user_id = $1`, [s.user.id]);
  await audit(db, actor, s.org.id, 'timer.discard', 'timer', s.user.id, t, null);
}

/** Accept a client timestamp for offline replays, but never in the future and max 36 h in the past. */
function clampAt(at?: string): string {
  const now = Date.now();
  if (!at) return new Date(now).toISOString();
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return new Date(now).toISOString();
  const min = now - 36 * 3600_000;
  return new Date(Math.min(now, Math.max(min, t))).toISOString();
}
