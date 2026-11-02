import 'server-only';
import type { DbClient } from '@/db/client';
import { ApiError } from './api';
import { audit, type AuditActor } from './audit';
import { hasRole, type Session } from './auth';
import { evaluateUserMonth } from './period';
import { getPeriod, getUser, type PeriodRow } from './repo';
import type { PeriodSummary } from '@/domain/types';
import { toISODate, monthRange } from '@/domain/time';

function compact(s: PeriodSummary): Record<string, unknown> {
  // persisted snapshot (without per-entry detail) for the archive/export
  return {
    targetMinutes: s.targetMinutes,
    workedMinutes: s.workedMinutes,
    travelMinutes: s.travelMinutes,
    creditMinutes: s.creditMinutes,
    timeCompMinutes: s.timeCompMinutes,
    overtimeMinutes: s.overtimeMinutes,
    overtime50Minutes: s.overtime50Minutes,
    overtime100Minutes: s.overtime100Minutes,
    mehrarbeitMinutes: s.mehrarbeitMinutes,
    nightMinutes: s.nightMinutes,
    sundayMinutes: s.sundayMinutes,
    holidayMinutes: s.holidayMinutes,
    absenceDays: s.absenceDays,
    holidayDays: s.holidayDays,
    remoteOnlyDays: s.remoteOnlyDays,
    workedDays: s.workedDays,
    byProject: s.byProject,
    byLocation: s.byLocation,
    errorCount: s.errorCount,
    warnCount: s.warnCount,
    violations: s.violations.map((v) => ({ code: v.code, severity: v.severity, date: v.date, message: v.message })),
    days: s.days.map((d) => ({ date: d.date, target: d.targetMinutes, worked: d.workedMinutes, breaks: d.breakMinutes, credit: d.creditMinutes, timeComp: d.timeCompMinutes, absence: d.absenceType ?? null, holiday: d.holidayName ?? null, first: d.firstStart, last: d.lastEnd })),
  };
}

export async function submitPeriod(db: DbClient, s: Session, actor: AuditActor, year: number, month: number, note: string | null, targetUserId?: string): Promise<PeriodRow> {
  const userId = targetUserId && targetUserId !== s.user.id ? targetUserId : s.user.id;
  if (userId !== s.user.id && !hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const user = userId === s.user.id ? s.user : await getUser(db, s.org.id, userId);
  if (!user) throw new ApiError(404, 'Mitarbeiter nicht gefunden.');
  const { to } = monthRange(year, month);
  const today = toISODate(new Date(), s.org.time_zone);
  if (today <= to && !hasRole(s.user, 'manager')) throw new ApiError(400, 'Der Monat kann erst nach seinem letzten Tag eingereicht werden.');
  const existing = await getPeriod(db, s.org.id, userId, year, month);
  if (existing && (existing.status === 'approved' || existing.status === 'exported')) throw new ApiError(409, 'Der Monat ist bereits freigegeben.');
  if (existing && existing.status === 'submitted') throw new ApiError(409, 'Der Monat wurde bereits eingereicht.');
  const { summary } = await evaluateUserMonth(db, s.org, user, year, month);
  if (summary.violations.some((v) => v.code === 'ENTRY_OPEN' || v.code === 'ENTRY_OVERLAP')) throw new ApiError(400, 'Bitte zuerst offene oder überlappende Buchungen korrigieren.');
  const snapshot = compact(summary);
  const { rows } = await db.query<PeriodRow>(
    `insert into zt_periods (org_id, user_id, year, month, status, submitted_at, submitted_ip, balance_start, balance_end, summary, employee_note)
     values ($1,$2,$3,$4,'submitted', now(), $5, $6, $7, $8, $9)
     on conflict (org_id, user_id, year, month) do update set status = 'submitted', submitted_at = now(), submitted_ip = excluded.submitted_ip, balance_start = excluded.balance_start, balance_end = excluded.balance_end, summary = excluded.summary, employee_note = excluded.employee_note, updated_at = now()
     returning *`,
    [s.org.id, userId, year, month, actor.ip ?? null, summary.balanceStartMinutes, summary.balanceEndMinutes, JSON.stringify(snapshot), note],
  );
  await db.query(`update zt_time_entries set status = 'submitted', updated_at = now() where org_id = $1 and user_id = $2 and date between $3 and $4 and deleted_at is null and status = 'open'`, [s.org.id, userId, summary.from, summary.to]);
  await audit(db, actor, s.org.id, 'period.submit', 'period', rows[0].id, existing, { year, month, balanceEnd: summary.balanceEndMinutes, note });
  return rows[0];
}

export async function approvePeriod(db: DbClient, s: Session, actor: AuditActor, userId: string, year: number, month: number): Promise<PeriodRow> {
  if (!hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const user = await getUser(db, s.org.id, userId);
  if (!user) throw new ApiError(404, 'Mitarbeiter nicht gefunden.');
  if (user.id === s.user.id && !hasRole(s.user, 'admin')) throw new ApiError(403, 'Eigene Monate können nur von Admins freigegeben werden.');
  const existing = await getPeriod(db, s.org.id, userId, year, month);
  // managers may approve directly (e.g. employee without own login) – re-evaluate to store a fresh snapshot
  const { summary } = await evaluateUserMonth(db, s.org, user, year, month);
  if (summary.violations.some((v) => v.code === 'ENTRY_OPEN' || v.code === 'ENTRY_OVERLAP')) throw new ApiError(400, 'Offene oder überlappende Buchungen müssen zuerst korrigiert werden.');
  const snapshot = compact(summary);
  const { rows } = await db.query<PeriodRow>(
    `insert into zt_periods (org_id, user_id, year, month, status, submitted_at, approved_by, approved_at, balance_start, balance_end, summary)
     values ($1,$2,$3,$4,'approved', now(), $5, now(), $6, $7, $8)
     on conflict (org_id, user_id, year, month) do update set status = 'approved', approved_by = excluded.approved_by, approved_at = now(), balance_start = excluded.balance_start, balance_end = excluded.balance_end, summary = excluded.summary, updated_at = now()
     returning *`,
    [s.org.id, userId, year, month, s.user.id, summary.balanceStartMinutes, summary.balanceEndMinutes, JSON.stringify(snapshot)],
  );
  await db.query(`update zt_time_entries set status = 'approved', updated_at = now() where org_id = $1 and user_id = $2 and date between $3 and $4 and deleted_at is null`, [s.org.id, userId, summary.from, summary.to]);
  await audit(db, actor, s.org.id, 'period.approve', 'period', rows[0].id, existing, { year, month, balanceEnd: summary.balanceEndMinutes });
  return rows[0];
}

export async function reopenPeriod(db: DbClient, s: Session, actor: AuditActor, userId: string, year: number, month: number, reason: string): Promise<PeriodRow> {
  if (!hasRole(s.user, 'admin')) throw new ApiError(403, 'Nur Admins können Monate wieder öffnen.');
  const existing = await getPeriod(db, s.org.id, userId, year, month);
  if (!existing) throw new ApiError(404, 'Kein Monatsabschluss vorhanden.');
  if (!reason.trim()) throw new ApiError(400, 'Bitte einen Grund angeben.');
  const { rows } = await db.query<PeriodRow>(`update zt_periods set status = 'reopened', updated_at = now() where id = $1 returning *`, [existing.id]);
  const { from, to } = monthRange(year, month);
  await db.query(`update zt_time_entries set status = 'open', updated_at = now() where org_id = $1 and user_id = $2 and date between $3 and $4 and deleted_at is null`, [s.org.id, userId, from, to]);
  await audit(db, actor, s.org.id, 'period.reopen', 'period', existing.id, existing, { reason });
  return rows[0];
}

export async function markExported(db: DbClient, s: Session, actor: AuditActor, year: number, month: number, userIds: string[]): Promise<number> {
  if (!hasRole(s.user, 'manager') && s.user.role !== 'payroll') throw new ApiError(403, 'Keine Berechtigung.');
  if (userIds.length === 0) return 0;
  const { rows } = await db.query<{ id: string }>(`update zt_periods set status = 'exported', exported_at = now(), updated_at = now() where org_id = $1 and year = $2 and month = $3 and status = 'approved' and user_id = any($4::uuid[]) returning id`, [s.org.id, year, month, userIds]);
  await audit(db, actor, s.org.id, 'period.export', 'period', null, null, { year, month, count: rows.length });
  return rows.length;
}
