import 'server-only';
import type { DbClient } from '@/db/client';
import type { Absence, AbsenceType, EntryLocation, EntrySource, EntryType, ISODate, TimeEntry } from '@/domain/types';
import type { UserRow } from './org';

// ---------- rows ----------
export interface EntryRow {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  start_at: string | null;
  end_at: string | null;
  break_minutes: number;
  duration_minutes: number | null;
  type: EntryType;
  location: EntryLocation;
  project_id: string | null;
  note: string | null;
  source: EntrySource;
  status: TimeEntry['status'];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface AbsenceRow {
  id: string;
  org_id: string;
  user_id: string;
  date_from: string;
  date_to: string;
  type: AbsenceType;
  half_day: boolean;
  note: string | null;
  status: Absence['status'];
  decided_by: string | null;
  decided_at: string | null;
  created_by: string | null;
  created_at: string;
}
export interface ProjectRow {
  id: string;
  org_id: string;
  code: string;
  name: string;
  customer: string | null;
  cost_center: string | null;
  color: string | null;
  billable: boolean;
  active: boolean;
}
export interface TimerRow {
  user_id: string;
  org_id: string;
  started_at: string;
  type: EntryType;
  location: EntryLocation;
  project_id: string | null;
  note: string | null;
  break_started_at: string | null;
  break_minutes: number;
}
export interface PeriodRow {
  id: string;
  org_id: string;
  user_id: string;
  year: number;
  month: number;
  status: 'open' | 'submitted' | 'approved' | 'exported' | 'reopened';
  submitted_at: string | null;
  submitted_ip: string | null;
  approved_by: string | null;
  approved_at: string | null;
  exported_at: string | null;
  balance_start: number;
  balance_end: number;
  summary: Record<string, unknown>;
  employee_note: string | null;
}

export function toEntry(r: EntryRow): TimeEntry {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    startAt: r.start_at,
    endAt: r.end_at,
    breakMinutes: r.break_minutes,
    durationMinutes: r.duration_minutes,
    type: r.type,
    location: r.location,
    projectId: r.project_id,
    note: r.note,
    source: r.source,
    status: r.status,
  };
}
export function toAbsence(r: AbsenceRow): Absence {
  return { id: r.id, userId: r.user_id, dateFrom: r.date_from, dateTo: r.date_to, type: r.type, portion: r.half_day ? 0.5 : 1, note: r.note, status: r.status };
}

// ---------- users ----------
export async function listUsers(db: DbClient, orgId: string, opts: { includeInactive?: boolean } = {}): Promise<UserRow[]> {
  const { rows } = await db.query<UserRow>(`select * from zt_users where org_id = $1 and deleted_at is null ${opts.includeInactive ? '' : 'and active'} order by name`, [orgId]);
  return rows;
}
export async function getUser(db: DbClient, orgId: string, id: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(`select * from zt_users where org_id = $1 and id = $2 and deleted_at is null`, [orgId, id]);
  return rows[0] ?? null;
}
/** Users visible to a manager: direct reports (and everyone for admins). */
export async function visibleUsers(db: DbClient, viewer: UserRow): Promise<UserRow[]> {
  if (viewer.role === 'owner' || viewer.role === 'admin' || viewer.role === 'payroll') return listUsers(db, viewer.org_id);
  if (viewer.role === 'manager') {
    const { rows } = await db.query<UserRow>(`select * from zt_users where org_id = $1 and deleted_at is null and active and (manager_id = $2 or id = $2) order by name`, [viewer.org_id, viewer.id]);
    return rows;
  }
  return [viewer];
}

// ---------- projects ----------
export async function listProjects(db: DbClient, orgId: string, onlyActive = true): Promise<ProjectRow[]> {
  const { rows } = await db.query<ProjectRow>(`select * from zt_projects where org_id = $1 ${onlyActive ? 'and active' : ''} order by code`, [orgId]);
  return rows;
}

// ---------- entries ----------
export async function listEntries(db: DbClient, orgId: string, userId: string, from: ISODate, to: ISODate): Promise<EntryRow[]> {
  const { rows } = await db.query<EntryRow>(
    `select * from zt_time_entries where org_id = $1 and user_id = $2 and deleted_at is null and date between $3 and $4 order by date, start_at nulls last, created_at`,
    [orgId, userId, from, to],
  );
  return rows;
}
export async function listOrgEntries(db: DbClient, orgId: string, from: ISODate, to: ISODate): Promise<EntryRow[]> {
  const { rows } = await db.query<EntryRow>(`select * from zt_time_entries where org_id = $1 and deleted_at is null and date between $2 and $3 order by user_id, date, start_at nulls last`, [orgId, from, to]);
  return rows;
}
export async function getEntry(db: DbClient, orgId: string, id: string): Promise<EntryRow | null> {
  const { rows } = await db.query<EntryRow>(`select * from zt_time_entries where org_id = $1 and id = $2 and deleted_at is null`, [orgId, id]);
  return rows[0] ?? null;
}
export interface EntryInput {
  date: ISODate;
  startAt: string | null;
  endAt: string | null;
  breakMinutes: number;
  durationMinutes: number | null;
  type: EntryType;
  location: EntryLocation;
  projectId: string | null;
  note: string | null;
  source: EntrySource;
}
export async function insertEntry(db: DbClient, orgId: string, userId: string, actorId: string | null, e: EntryInput): Promise<EntryRow> {
  const { rows } = await db.query<EntryRow>(
    `insert into zt_time_entries (org_id, user_id, date, start_at, end_at, break_minutes, duration_minutes, type, location, project_id, note, source, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [orgId, userId, e.date, e.startAt, e.endAt, e.breakMinutes, e.durationMinutes, e.type, e.location, e.projectId, e.note, e.source, actorId],
  );
  return rows[0];
}
export async function updateEntry(db: DbClient, orgId: string, id: string, e: Partial<EntryInput>): Promise<EntryRow> {
  const sets: string[] = [];
  const params: unknown[] = [orgId, id];
  const map: Record<string, string> = { date: 'date', startAt: 'start_at', endAt: 'end_at', breakMinutes: 'break_minutes', durationMinutes: 'duration_minutes', type: 'type', location: 'location', projectId: 'project_id', note: 'note', source: 'source' };
  for (const [k, col] of Object.entries(map)) {
    if (k in e) {
      params.push((e as Record<string, unknown>)[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  sets.push(`updated_at = now()`);
  const { rows } = await db.query<EntryRow>(`update zt_time_entries set ${sets.join(', ')} where org_id = $1 and id = $2 returning *`, params);
  return rows[0];
}
export async function softDeleteEntry(db: DbClient, orgId: string, id: string): Promise<void> {
  await db.query(`update zt_time_entries set deleted_at = now(), updated_at = now() where org_id = $1 and id = $2`, [orgId, id]);
}

// ---------- absences ----------
export async function listAbsences(db: DbClient, orgId: string, userId: string, from: ISODate, to: ISODate): Promise<AbsenceRow[]> {
  const { rows } = await db.query<AbsenceRow>(
    `select * from zt_absences where org_id = $1 and user_id = $2 and deleted_at is null and date_from <= $4 and date_to >= $3 order by date_from`,
    [orgId, userId, from, to],
  );
  return rows;
}
export async function listOrgAbsences(db: DbClient, orgId: string, from: ISODate, to: ISODate, status?: AbsenceRow['status']): Promise<AbsenceRow[]> {
  const params: unknown[] = [orgId, from, to];
  let sql = `select * from zt_absences where org_id = $1 and deleted_at is null and date_from <= $3 and date_to >= $2`;
  if (status) {
    params.push(status);
    sql += ` and status = $4`;
  }
  const { rows } = await db.query<AbsenceRow>(sql + ` order by date_from`, params);
  return rows;
}
export async function insertAbsence(db: DbClient, orgId: string, userId: string, actorId: string, a: { dateFrom: ISODate; dateTo: ISODate; type: AbsenceType; halfDay: boolean; note: string | null; status: AbsenceRow['status'] }): Promise<AbsenceRow> {
  const { rows } = await db.query<AbsenceRow>(
    `insert into zt_absences (org_id, user_id, date_from, date_to, type, half_day, note, status, created_by, decided_by, decided_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9, case when $8 = 'approved' then $9 else null end, case when $8 = 'approved' then now() else null end) returning *`,
    [orgId, userId, a.dateFrom, a.dateTo, a.type, a.halfDay, a.note, a.status, actorId],
  );
  return rows[0];
}
export async function decideAbsence(db: DbClient, orgId: string, id: string, actorId: string, status: 'approved' | 'rejected'): Promise<AbsenceRow | null> {
  const { rows } = await db.query<AbsenceRow>(`update zt_absences set status = $3, decided_by = $4, decided_at = now(), updated_at = now() where org_id = $1 and id = $2 and deleted_at is null returning *`, [orgId, id, status, actorId]);
  return rows[0] ?? null;
}
export async function softDeleteAbsence(db: DbClient, orgId: string, id: string): Promise<void> {
  await db.query(`update zt_absences set deleted_at = now(), updated_at = now() where org_id = $1 and id = $2`, [orgId, id]);
}

// ---------- timers ----------
export async function getTimer(db: DbClient, userId: string): Promise<TimerRow | null> {
  const { rows } = await db.query<TimerRow>(`select * from zt_timers where user_id = $1`, [userId]);
  return rows[0] ?? null;
}

// ---------- periods ----------
export async function getPeriod(db: DbClient, orgId: string, userId: string, year: number, month: number): Promise<PeriodRow | null> {
  const { rows } = await db.query<PeriodRow>(`select * from zt_periods where org_id = $1 and user_id = $2 and year = $3 and month = $4`, [orgId, userId, year, month]);
  return rows[0] ?? null;
}
export async function listPeriods(db: DbClient, orgId: string, year: number, month: number): Promise<PeriodRow[]> {
  const { rows } = await db.query<PeriodRow>(`select * from zt_periods where org_id = $1 and year = $2 and month = $3`, [orgId, year, month]);
  return rows;
}
export async function latestClosedPeriodBefore(db: DbClient, orgId: string, userId: string, year: number, month: number): Promise<PeriodRow | null> {
  const { rows } = await db.query<PeriodRow>(
    `select * from zt_periods where org_id = $1 and user_id = $2 and status in ('approved','exported') and (year * 100 + month) < $3 order by year desc, month desc limit 1`,
    [orgId, userId, year * 100 + month],
  );
  return rows[0] ?? null;
}
export function isLockedStatus(status: PeriodRow['status'] | undefined | null): boolean {
  return status === 'submitted' || status === 'approved' || status === 'exported';
}
