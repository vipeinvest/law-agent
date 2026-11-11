import 'server-only';
import { z } from 'zod';
import type { DbClient } from '@/db/client';
import { ApiError } from './api';
import { audit, type AuditActor } from './audit';
import { hasRole, type Session } from './auth';
import { orgRules, userEmployment, type OrgRow, type UserRow } from './org';
import { getPeriod, getUser, insertEntry, isLockedStatus, listEntries, listOrgAbsences, listUsers, visibleUsers } from './repo';
import { listShifts, type ShiftRow } from './repo-v2';
import { assertPeriodEditable } from './entries';
import { evaluatePeriod } from '@/domain/rules';
import type { EntryLocation, TimeEntry, Violation } from '@/domain/types';
import { addDays, isoWeekKey, localDateTimeToInstant, minutesBetween, toISODate, weekStart } from '@/domain/time';
import { escapeHtml, layout, sendMail } from './mail';
import { env } from './env';
import { ABSENCE_LABELS, fmtDate, LOCATION_LABELS, WEEKDAYS_SHORT } from './format';

export const shiftSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  breakMinutes: z.number().int().min(0).max(600).default(30),
  location: z.enum(['office', 'remote', 'field']).default('office'),
  projectId: z.string().uuid().nullable().optional(),
  note: z.string().max(300).nullable().optional(),
});
export type ShiftInput = z.infer<typeof shiftSchema>;

export function shiftNetMinutes(s: Pick<ShiftRow, 'start_time' | 'end_time' | 'break_minutes'>): number {
  const [sh, sm] = s.start_time.split(':').map(Number);
  const [eh, em] = s.end_time.split(':').map(Number);
  let gross = eh * 60 + em - (sh * 60 + sm);
  if (gross <= 0) gross += 24 * 60; // over midnight
  return Math.max(0, gross - s.break_minutes);
}

/** Planned minutes per date for one employee (published shifts only). */
export async function plannedMinutes(db: DbClient, orgId: string, userId: string, from: string, to: string): Promise<Record<string, number>> {
  const shifts = await listShifts(db, orgId, from, to, userId);
  const out: Record<string, number> = {};
  for (const s of shifts) if (s.status === 'published') out[s.date] = (out[s.date] ?? 0) + shiftNetMinutes(s);
  return out;
}

export async function upsertShift(db: DbClient, s: Session, actor: AuditActor, input: ShiftInput): Promise<ShiftRow> {
  if (!hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const user = await getUser(db, s.org.id, input.userId);
  if (!user) throw new ApiError(404, 'Mitarbeiter nicht gefunden.');
  if (input.start === input.end) throw new ApiError(400, 'Beginn und Ende sind gleich.');
  const net = shiftNetMinutes({ start_time: input.start, end_time: input.end, break_minutes: input.breakMinutes });
  if (net > 720) throw new ApiError(400, 'Eine Schicht darf netto nicht länger als 12 Stunden sein (AZG § 9).');
  if (input.id) {
    const { rows: before } = await db.query<ShiftRow>(`select * from zt_shifts where org_id = $1 and id = $2 and deleted_at is null`, [s.org.id, input.id]);
    if (!before[0]) throw new ApiError(404, 'Schicht nicht gefunden.');
    const { rows } = await db.query<ShiftRow>(`update zt_shifts set user_id = $3, date = $4, start_time = $5, end_time = $6, break_minutes = $7, location = $8, project_id = $9, note = $10, status = 'draft', updated_at = now() where org_id = $1 and id = $2 returning *`, [s.org.id, input.id, input.userId, input.date, input.start, input.end, input.breakMinutes, input.location, input.projectId ?? null, input.note ?? null]);
    await audit(db, actor, s.org.id, 'shift.update', 'shift', input.id, before[0], rows[0]);
    return rows[0];
  }
  const { rows } = await db.query<ShiftRow>(`insert into zt_shifts (org_id, user_id, date, start_time, end_time, break_minutes, location, project_id, note, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`, [s.org.id, input.userId, input.date, input.start, input.end, input.breakMinutes, input.location, input.projectId ?? null, input.note ?? null, s.user.id]);
  await audit(db, actor, s.org.id, 'shift.create', 'shift', rows[0].id, null, rows[0]);
  return rows[0];
}

export async function deleteShift(db: DbClient, s: Session, actor: AuditActor, id: string): Promise<void> {
  if (!hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const { rows } = await db.query<ShiftRow>(`update zt_shifts set deleted_at = now(), updated_at = now() where org_id = $1 and id = $2 and deleted_at is null returning *`, [s.org.id, id]);
  if (rows[0]) await audit(db, actor, s.org.id, 'shift.delete', 'shift', id, rows[0], null);
}

/** Copy all shifts of the source week to the target week (drafts). */
export async function copyWeek(db: DbClient, s: Session, actor: AuditActor, fromMonday: string, toMonday: string, userIds?: string[]): Promise<number> {
  if (!hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const src = await listShifts(db, s.org.id, fromMonday, addDays(fromMonday, 6));
  const existing = await listShifts(db, s.org.id, toMonday, addDays(toMonday, 6));
  const offset = Math.round((new Date(toMonday).getTime() - new Date(fromMonday).getTime()) / 86400000);
  let n = 0;
  for (const sh of src) {
    if (userIds && !userIds.includes(sh.user_id)) continue;
    const date = addDays(sh.date, offset);
    if (existing.some((e) => e.user_id === sh.user_id && e.date === date && e.start_time === sh.start_time)) continue;
    await db.query(`insert into zt_shifts (org_id, user_id, date, start_time, end_time, break_minutes, location, project_id, note, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [s.org.id, sh.user_id, date, sh.start_time, sh.end_time, sh.break_minutes, sh.location, sh.project_id, sh.note, s.user.id]);
    n++;
  }
  await audit(db, actor, s.org.id, 'shift.copy_week', 'shift', null, null, { fromMonday, toMonday, copied: n });
  return n;
}

export interface PublishCheck {
  userId: string;
  userName: string;
  violations: Violation[];
}

/** AZG pre-check of the planned week (treats shifts as if worked; includes real entries of surrounding days). */
export async function checkWeek(db: DbClient, org: OrgRow, monday: string, userIds?: string[]): Promise<PublishCheck[]> {
  const rules = orgRules(org);
  const sunday = addDays(monday, 6);
  const shifts = await listShifts(db, org.id, addDays(monday, -7), addDays(sunday, 7));
  const users = (await listUsers(db, org.id)).filter((u) => !userIds || userIds.includes(u.id));
  const approvedAbsences = await listOrgAbsences(db, org.id, monday, sunday, 'approved');
  const out: PublishCheck[] = [];
  for (const u of users) {
    const mine = shifts.filter((x) => x.user_id === u.id);
    if (!mine.some((x) => x.date >= monday && x.date <= sunday)) continue;
    const synthetic: TimeEntry[] = mine.map((x) => {
      const startAt = localDateTimeToInstant(x.date, x.start_time, org.time_zone);
      let endAt = localDateTimeToInstant(x.date, x.end_time, org.time_zone);
      if (endAt <= startAt) endAt = localDateTimeToInstant(addDays(x.date, 1), x.end_time, org.time_zone);
      return { id: `plan-${x.id}`, userId: u.id, date: x.date, startAt, endAt, breakMinutes: x.break_minutes, durationMinutes: null, type: 'work', location: x.location, projectId: x.project_id, note: null, source: 'plan', status: 'open' };
    });
    const months = new Set([monday.slice(0, 7), sunday.slice(0, 7)]);
    const violations: Violation[] = [];
    for (const ym of months) {
      const r = evaluatePeriod({ userId: u.id, year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)), rules, employment: userEmployment(u, rules), entries: synthetic, absences: [], balanceStartMinutes: 0, now: '2100-01-01T00:00:00Z' });
      for (const v of r.violations) if (v.date >= monday && v.date <= sunday && v.severity !== 'info' && v.code !== 'ENTRY_OPEN') violations.push(v);
    }
    for (const x of mine) {
      if (x.date < monday || x.date > sunday) continue;
      const a = approvedAbsences.find((ab) => ab.user_id === u.id && ab.date_from <= x.date && ab.date_to >= x.date);
      if (a) violations.push({ code: 'PLAN_ON_ABSENCE', severity: 'warn', date: x.date, message: `Schicht ${x.start_time}–${x.end_time} geplant trotz genehmigter Abwesenheit (${ABSENCE_LABELS[a.type] ?? a.type}${a.half_day ? ', halber Tag' : ''}).`, legalRef: 'Dienstplan' });
    }
    const seen = new Set<string>();
    out.push({ userId: u.id, userName: u.name, violations: violations.filter((v) => !seen.has(v.code + v.date) && seen.add(v.code + v.date)) });
  }
  return out;
}

export async function publishWeek(db: DbClient, s: Session, actor: AuditActor, monday: string, opts: { force?: boolean; notify?: boolean } = {}): Promise<{ published: number; checks: PublishCheck[] }> {
  if (!hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const sunday = addDays(monday, 6);
  const checks = await checkWeek(db, s.org, monday);
  const hasErrors = checks.some((c) => c.violations.some((v) => v.severity === 'error'));
  if (hasErrors && !opts.force) return { published: 0, checks };
  const { rows } = await db.query<{ id: string; user_id: string }>(`update zt_shifts set status = 'published', updated_at = now() where org_id = $1 and deleted_at is null and status = 'draft' and date between $2 and $3 returning id, user_id`, [s.org.id, monday, sunday]);
  await audit(db, actor, s.org.id, 'shift.publish', 'shift', null, null, { monday, published: rows.length, forced: hasErrors });
  if (opts.notify !== false && rows.length) {
    const shifts = await listShifts(db, s.org.id, monday, sunday);
    const users = await listUsers(db, s.org.id);
    const byUser = new Map<string, ShiftRow[]>();
    for (const sh of shifts) if (sh.status === 'published') byUser.set(sh.user_id, [...(byUser.get(sh.user_id) ?? []), sh]);
    const appName = (s.org.theme as { appName?: string })?.appName || s.org.name;
    for (const [uid, list] of byUser) {
      const u = users.find((x) => x.id === uid);
      if (!u) continue;
      const lines = list.map((x) => `${WEEKDAYS_SHORT[new Date(x.date + 'T00:00:00Z').getUTCDay() === 0 ? 6 : new Date(x.date + 'T00:00:00Z').getUTCDay() - 1]} ${fmtDate(x.date, { year: false })}  ${x.start_time}–${x.end_time}  Pause ${x.break_minutes} min  ${LOCATION_LABELS[x.location]}${x.note ? '  · ' + x.note : ''}`);
      const text = `Hallo ${u.name.split(' ')[0]},\n\ndein Dienstplan für ${isoWeekKey(monday).replace('-W', ' KW ')} (${fmtDate(monday)}–${fmtDate(sunday)}):\n\n${lines.join('\n')}\n\nIn ${appName} kannst du geplante Tage mit einem Tipp als gearbeitet übernehmen, wenn alles wie geplant war – Abweichungen bitte stempeln oder nachtragen.\n${env.appUrl}/app/woche?d=${monday}`;
      await sendMail({ to: u.email, subject: `Dienstplan ${isoWeekKey(monday).replace('-W', ' KW ')} – ${s.org.name}`, text, html: layout('Dein Dienstplan', `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(text)}</pre>`, { name: appName, color: (s.org.theme as { primary?: string })?.primary }), template: 'roster_published', orgId: s.org.id });
    }
  }
  return { published: rows.length, checks };
}

/** Employee (or manager for a team member): create time entries from published shifts of a day/range without entries. */
export async function adoptPlan(db: DbClient, s: Session, actor: AuditActor, from: string, to: string, targetUserId?: string): Promise<{ created: number; skipped: number }> {
  const userId = targetUserId && targetUserId !== s.user.id ? targetUserId : s.user.id;
  if (userId !== s.user.id && !hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const today = toISODate(new Date(), s.org.time_zone);
  if (to > today) to = today;
  if (from > to) return { created: 0, skipped: 0 };
  const shifts = (await listShifts(db, s.org.id, from, to, userId)).filter((x) => x.status === 'published');
  const entries = await listEntries(db, s.org.id, userId, from, to);
  let created = 0;
  let skipped = 0;
  for (const sh of shifts) {
    if (entries.some((e) => e.date === sh.date && e.type === 'work')) {
      skipped++;
      continue;
    }
    await assertPeriodEditable(db, s, userId, sh.date);
    const startAt = localDateTimeToInstant(sh.date, sh.start_time, s.org.time_zone);
    let endAt = localDateTimeToInstant(sh.date, sh.end_time, s.org.time_zone);
    if (endAt <= startAt) endAt = localDateTimeToInstant(addDays(sh.date, 1), sh.end_time, s.org.time_zone);
    if (sh.date === today && new Date(endAt) > new Date()) {
      skipped++;
      continue; // shift not over yet
    }
    const row = await insertEntry(db, s.org.id, userId, s.user.id, { date: sh.date, startAt, endAt, breakMinutes: sh.break_minutes, durationMinutes: null, type: 'work', location: sh.location, projectId: sh.project_id, note: sh.note ? `Plan: ${sh.note}` : 'wie geplant', source: 'plan' });
    await db.query(`update zt_shifts set adopted_entry_id = $2 where id = $1`, [sh.id, row.id]);
    await audit(db, actor, s.org.id, 'plan.adopt', 'time_entry', row.id, null, { shiftId: sh.id, date: sh.date, minutes: minutesBetween(startAt, endAt) - sh.break_minutes });
    created++;
  }
  return { created, skipped };
}

/** Week view data for the planner. */
export async function weekPlan(db: DbClient, s: Session, monday: string) {
  const users = (await visibleUsers(db, s.user)).filter((u) => u.role !== 'payroll');
  const shifts = await listShifts(db, s.org.id, monday, addDays(monday, 6));
  const prevWeekCount = (await listShifts(db, s.org.id, addDays(monday, -7), addDays(monday, -1))).length;
  const ids = new Set(users.map((u) => u.id));
  const absences = (await listOrgAbsences(db, s.org.id, monday, addDays(monday, 6))).filter((a) => ids.has(a.user_id) && a.status !== 'rejected');
  return { users, shifts, absences, prevWeekCount, monday, days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)) };
}

export { weekStart };
export type { UserRow };

/** Per-day plan view for the employee pages (which days are planned, adopted or still adoptable). */
export interface PlanDay {
  shiftId: string;
  start: string;
  end: string;
  breakMinutes: number;
  location: EntryLocation;
  note: string | null;
  adopted: boolean;
  /** shift is published, over, not yet adopted – the user may take it over with one tap */
  adoptable: boolean;
}

export async function planForDays(db: DbClient, org: OrgRow, userId: string, from: string, to: string, entries: Array<{ date: string; type: string }>): Promise<Record<string, PlanDay>> {
  const today = toISODate(new Date(), org.time_zone);
  const now = Date.now();
  const shifts = (await listShifts(db, org.id, from, to, userId)).filter((x) => x.status === 'published');
  const out: Record<string, PlanDay> = {};
  for (const sh of shifts) {
    const startAt = localDateTimeToInstant(sh.date, sh.start_time, org.time_zone);
    let endAt = localDateTimeToInstant(sh.date, sh.end_time, org.time_zone);
    if (endAt <= startAt) endAt = localDateTimeToInstant(addDays(sh.date, 1), sh.end_time, org.time_zone);
    const hasWork = entries.some((e) => e.date === sh.date && e.type === 'work');
    const adopted = !!sh.adopted_entry_id || hasWork;
    out[sh.date] = { shiftId: sh.id, start: sh.start_time, end: sh.end_time, breakMinutes: sh.break_minutes, location: sh.location, note: sh.note, adopted, adoptable: !adopted && sh.date <= today && new Date(endAt).getTime() <= now };
  }
  return out;
}

/**
 * Nightly system job: for employees with employment.autoAdoptPlan, published shifts of the last 7 days
 * (yesterday and earlier) without any work entry become time entries (source 'plan'). The employee is
 * informed via the day list ("Plan · gebucht") and can correct the entry as long as the month is open.
 * Nothing is adopted for the current day, for locked months or when any work entry already exists.
 */
export async function autoAdoptPlans(db: DbClient): Promise<{ created: number }> {
  const { rows: orgs } = await db.query<OrgRow>(`select * from zt_orgs where deleted_at is null`);
  let created = 0;
  for (const org of orgs) {
    const today = toISODate(new Date(), org.time_zone);
    const from = addDays(today, -7);
    const to = addDays(today, -1);
    const users = (await listUsers(db, org.id)).filter((u) => (u.employment as { autoAdoptPlan?: boolean } | null)?.autoAdoptPlan);
    for (const u of users) {
      const shifts = (await listShifts(db, org.id, from, to, u.id)).filter((x) => x.status === 'published' && !x.adopted_entry_id);
      if (!shifts.length) continue;
      const entries = await listEntries(db, org.id, u.id, from, to);
      for (const sh of shifts) {
        if (entries.some((e) => e.date === sh.date && e.type === 'work')) continue;
        const period = await getPeriod(db, org.id, u.id, Number(sh.date.slice(0, 4)), Number(sh.date.slice(5, 7)));
        if (isLockedStatus(period?.status)) continue;
        const startAt = localDateTimeToInstant(sh.date, sh.start_time, org.time_zone);
        let endAt = localDateTimeToInstant(sh.date, sh.end_time, org.time_zone);
        if (endAt <= startAt) endAt = localDateTimeToInstant(addDays(sh.date, 1), sh.end_time, org.time_zone);
        const row = await insertEntry(db, org.id, u.id, null, { date: sh.date, startAt, endAt, breakMinutes: sh.break_minutes, durationMinutes: null, type: 'work', location: sh.location, projectId: sh.project_id, note: sh.note ? `Plan (automatisch): ${sh.note}` : 'wie geplant (automatisch)', source: 'plan' });
        await db.query(`update zt_shifts set adopted_entry_id = $2 where id = $1`, [sh.id, row.id]);
        await audit(db, { id: null, email: 'system', ip: null }, org.id, 'plan.auto_adopt', 'time_entry', row.id, null, { shiftId: sh.id, date: sh.date, userId: u.id });
        created++;
      }
    }
  }
  return { created };
}
