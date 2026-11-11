import 'server-only';
import { z } from 'zod';
import type { DbClient } from '@/db/client';
import { ApiError } from './api';
import { audit, type AuditActor } from './audit';
import { getPeriod, insertEntry, isLockedStatus, softDeleteEntry, updateEntry, getEntry, type EntryRow } from './repo';
import { localDateTimeToInstant, minutesBetween, toISODate } from '@/domain/time';
import type { Session } from './auth';
import { hasRole } from './auth';

export const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endNextDay: z.boolean().optional(),
  breakMinutes: z.number().int().min(0).max(600).default(0),
  durationMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  type: z.enum(['work', 'travel', 'oncall']).default('work'),
  location: z.enum(['office', 'remote', 'field']).default('office'),
  projectId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  userId: z.string().uuid().optional(), // admins may book for others
});
export type EntryPayload = z.infer<typeof entrySchema>;

export async function assertPeriodEditable(db: DbClient, s: Session, userId: string, date: string): Promise<void> {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const p = await getPeriod(db, s.org.id, userId, year, month);
  if (p && isLockedStatus(p.status)) {
    if (p.status === 'submitted' && hasRole(s.user, 'manager')) return; // managers may correct submitted months before approval
    throw new ApiError(409, p.status === 'submitted' ? 'Der Monat wurde bereits eingereicht. Bitte Vorgesetzte um Korrektur bitten.' : 'Der Monat ist freigegeben und gesperrt.');
  }
}

export function resolveTargetUser(s: Session, requested?: string): string {
  if (!requested || requested === s.user.id) return s.user.id;
  if (!hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung für andere Mitarbeiter.');
  return requested;
}

function toInstants(p: EntryPayload, timeZone: string): { startAt: string | null; endAt: string | null } {
  if (!p.start) return { startAt: null, endAt: null };
  const startAt = localDateTimeToInstant(p.date, p.start, timeZone);
  let endAt: string | null = null;
  if (p.end) {
    const endDate = p.endNextDay ? nextDay(p.date) : p.date;
    endAt = localDateTimeToInstant(endDate, p.end, timeZone);
    if (endAt <= startAt) {
      // tolerate implicit next-day end (e.g. 22:00–02:00)
      endAt = localDateTimeToInstant(nextDay(p.date), p.end, timeZone);
    }
    if (minutesBetween(startAt, endAt) > 24 * 60) throw new ApiError(400, 'Eine Buchung darf nicht länger als 24 Stunden sein.');
  }
  return { startAt, endAt };
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return n.toISOString().slice(0, 10);
}

export async function createEntry(db: DbClient, s: Session, actor: AuditActor, p: EntryPayload, timeZone: string, source: 'manual' | 'import' | 'correction' = 'manual'): Promise<EntryRow> {
  const userId = resolveTargetUser(s, p.userId);
  await assertPeriodEditable(db, s, userId, p.date);
  const { startAt, endAt } = toInstants(p, timeZone);
  if (!startAt && p.durationMinutes == null) throw new ApiError(400, 'Bitte Beginn/Ende oder eine Dauer angeben.');
  if (startAt && !endAt) throw new ApiError(400, 'Bitte ein Ende angeben.');
  const row = await insertEntry(db, s.org.id, userId, s.user.id, {
    date: p.date,
    startAt,
    endAt,
    breakMinutes: p.breakMinutes ?? 0,
    durationMinutes: startAt ? null : (p.durationMinutes ?? null),
    type: p.type,
    location: p.location,
    projectId: p.projectId ?? null,
    note: p.note?.trim() || null,
    source,
  });
  await audit(db, actor, s.org.id, 'entry.create', 'time_entry', row.id, null, row);
  return row;
}

export async function patchEntry(db: DbClient, s: Session, actor: AuditActor, id: string, p: Partial<EntryPayload>, timeZone: string): Promise<EntryRow> {
  const before = await getEntry(db, s.org.id, id);
  if (!before) throw new ApiError(404, 'Buchung nicht gefunden.');
  if (before.user_id !== s.user.id && !hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  await assertPeriodEditable(db, s, before.user_id, before.date);
  if (p.date) await assertPeriodEditable(db, s, before.user_id, p.date);
  const merged: EntryPayload = {
    date: p.date ?? before.date,
    start: p.start === undefined ? (before.start_at ? toTime(before.start_at, timeZone) : null) : p.start,
    end: p.end === undefined ? (before.end_at ? toTime(before.end_at, timeZone) : null) : p.end,
    endNextDay: p.endNextDay ?? (before.start_at && before.end_at ? toISODate(before.end_at, timeZone) !== before.date : false),
    breakMinutes: p.breakMinutes ?? before.break_minutes,
    durationMinutes: p.durationMinutes === undefined ? before.duration_minutes : p.durationMinutes,
    type: p.type ?? before.type,
    location: p.location ?? before.location,
    projectId: p.projectId === undefined ? before.project_id : p.projectId,
    note: p.note === undefined ? before.note : p.note,
  };
  const { startAt, endAt } = toInstants(merged, timeZone);
  if (startAt && !endAt) throw new ApiError(400, 'Bitte ein Ende angeben.');
  const row = await updateEntry(db, s.org.id, id, {
    date: merged.date,
    startAt,
    endAt,
    breakMinutes: merged.breakMinutes,
    durationMinutes: startAt ? null : (merged.durationMinutes ?? null),
    type: merged.type,
    location: merged.location,
    projectId: merged.projectId ?? null,
    note: merged.note?.trim() || null,
    source: before.user_id !== s.user.id ? 'correction' : before.source,
  });
  await audit(db, actor, s.org.id, 'entry.update', 'time_entry', id, before, row);
  return row;
}

export async function removeEntry(db: DbClient, s: Session, actor: AuditActor, id: string): Promise<void> {
  const before = await getEntry(db, s.org.id, id);
  if (!before) throw new ApiError(404, 'Buchung nicht gefunden.');
  if (before.user_id !== s.user.id && !hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  await assertPeriodEditable(db, s, before.user_id, before.date);
  await softDeleteEntry(db, s.org.id, id);
  await audit(db, actor, s.org.id, 'entry.delete', 'time_entry', id, before, null);
}

function toTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(iso));
}
