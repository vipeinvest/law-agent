import 'server-only';
import type { DbClient } from '@/db/client';
import { audit, type AuditActor } from './audit';

/** Löschkonzept – automatisierte Fristen (siehe deliverables/zeitly/04_Loesch_und_Aufbewahrungskonzept). */
export const RETENTION = {
  loginCodesHours: 24,
  sessionsDays: 90, // Anmeldeprotokoll
  mailLogDays: 365,
  importJobsDays: 365,
  recordsYears: 7, // § 132 BAO
};

export interface HousekeepingResult {
  loginCodes: number;
  sessions: number;
  mailLog: number;
  importJobs: number;
  autoAdopted: number;
  at: string;
}

export async function runHousekeeping(db: DbClient): Promise<HousekeepingResult> {
  const del = async (sql: string, params: unknown[]) => (await db.query<{ n: number }>(`with d as (${sql} returning 1) select count(*)::int as n from d`, params)).rows[0]?.n ?? 0;
  const loginCodes = await del(`delete from zt_login_codes where created_at < now() - ($1 || ' hours')::interval`, [String(RETENTION.loginCodesHours)]);
  const sessions = await del(`delete from zt_sessions where expires_at < now() - interval '1 day' or last_seen_at < now() - ($1 || ' days')::interval`, [String(RETENTION.sessionsDays)]);
  const mailLog = await del(`delete from zt_mail_log where created_at < now() - ($1 || ' days')::interval`, [String(RETENTION.mailLogDays)]);
  const importJobs = await del(`delete from zt_import_jobs where created_at < now() - ($1 || ' days')::interval`, [String(RETENTION.importJobsDays)]);
  let autoAdopted = 0;
  try {
    autoAdopted = (await (await import('./roster')).autoAdoptPlans(db)).created;
  } catch (e) {
    console.warn('[housekeeping] auto-adopt failed', e instanceof Error ? e.message : e);
  }
  return { loginCodes, sessions, mailLog, importJobs, autoAdopted, at: new Date().toISOString() };
}

export interface RetentionPreview {
  cutoffDate: string;
  formerEmployees: Array<{ id: string; name: string; email: string; endDate: string | null; entries: number; lastEntry: string | null }>;
  oldEntries: number;
  oldAbsences: number;
  oldAudit: number;
}

/** Vorschau Löschlauf: Daten, deren Aufbewahrungsfrist (7 Jahre nach Jahresende) abgelaufen ist. */
export async function retentionPreview(db: DbClient, orgId: string): Promise<RetentionPreview> {
  const cutoffYear = new Date().getUTCFullYear() - RETENTION.recordsYears - 1; // Frist läuft ab Ende des Jahres
  const cutoffDate = `${cutoffYear}-12-31`;
  const { rows: former } = await db.query<{ id: string; name: string; email: string; end_date: string | null; entries: number; last_entry: string | null }>(
    `select u.id, u.name, u.email, u.employment->>'endDate' as end_date,
            (select count(*) from zt_time_entries e where e.user_id = u.id)::int as entries,
            (select max(date)::text from zt_time_entries e where e.user_id = u.id) as last_entry
       from zt_users u where u.org_id = $1 and u.deleted_at is null and u.active = false
        and coalesce((u.employment->>'endDate')::date, u.updated_at::date) <= $2::date
        and u.email not like 'geloescht-%'`,
    [orgId, cutoffDate],
  );
  const count = async (sql: string) => (await db.query<{ n: number }>(sql, [orgId, cutoffDate])).rows[0]?.n ?? 0;
  return {
    cutoffDate,
    formerEmployees: former.map((f) => ({ id: f.id, name: f.name, email: f.email, endDate: f.end_date, entries: f.entries, lastEntry: f.last_entry })),
    oldEntries: await count(`select count(*)::int as n from zt_time_entries where org_id = $1 and date <= $2::date`),
    oldAbsences: await count(`select count(*)::int as n from zt_absences where org_id = $1 and date_to <= $2::date`),
    oldAudit: await count(`select count(*)::int as n from zt_audit_log where org_id = $1 and at <= ($2::date + interval '1 day')`),
  };
}

/** Löschlauf: Buchungen/Abwesenheiten/Protokoll vor dem Stichtag löschen, ausgeschiedene Mitarbeiter anonymisieren. */
export async function runRetention(db: DbClient, orgId: string, actor: AuditActor): Promise<{ deletedEntries: number; deletedAbsences: number; deletedAudit: number; anonymized: number; cutoffDate: string }> {
  const preview = await retentionPreview(db, orgId);
  const del = async (sql: string, params: unknown[]) => (await db.query<{ n: number }>(`with d as (${sql} returning 1) select count(*)::int as n from d`, params)).rows[0]?.n ?? 0;
  const deletedEntries = await del(`delete from zt_time_entries where org_id = $1 and date <= $2::date`, [orgId, preview.cutoffDate]);
  const deletedAbsences = await del(`delete from zt_absences where org_id = $1 and date_to <= $2::date`, [orgId, preview.cutoffDate]);
  await db.query(`delete from zt_periods where org_id = $1 and make_date(year, month, 1) <= $2::date`, [orgId, preview.cutoffDate]);
  const deletedAudit = await del(`delete from zt_audit_log where org_id = $1 and at <= ($2::date + interval '1 day')`, [orgId, preview.cutoffDate]);
  let anonymized = 0;
  for (const f of preview.formerEmployees) {
    await db.query(`update zt_users set name = 'Ehemalige:r Mitarbeiter:in', email = 'geloescht-' || substr(md5(id::text), 1, 12) || '@anonym.invalid', personnel_no = null, employment = '{}'::jsonb, manager_id = null, updated_at = now(), deleted_at = now() where id = $1`, [f.id]);
    await db.query(`update zt_time_entries set note = null where user_id = $1`, [f.id]);
    await db.query(`update zt_absences set note = null where user_id = $1`, [f.id]);
    anonymized++;
  }
  await audit(db, actor, orgId, 'retention.run', 'org', orgId, null, { cutoffDate: preview.cutoffDate, deletedEntries, deletedAbsences, deletedAudit, anonymized });
  return { deletedEntries, deletedAbsences, deletedAudit, anonymized, cutoffDate: preview.cutoffDate };
}
