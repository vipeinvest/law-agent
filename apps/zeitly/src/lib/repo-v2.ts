import 'server-only';
import type { DbClient } from '@/db/client';
import type { DocKind, Profile, ProfileIssue } from '@/domain/onboarding';
import type { EntryLocation } from '@/domain/types';

export interface FileRow {
  id: string;
  org_id: string;
  user_id: string | null;
  kind: DocKind;
  filename: string;
  mime: string;
  size_bytes: number;
  sha256: string;
  extracted: Record<string, unknown> | null;
  created_at: string;
}
export interface ProfileRow {
  user_id: string;
  org_id: string;
  data: Partial<Profile>;
  consents: Record<string, unknown>;
  completeness: number;
  validation: ProfileIssue[];
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_to_payroll_at: string | null;
  updated_at: string;
}
export interface OnboardingRow {
  id: string;
  org_id: string;
  user_id: string;
  status: 'sent' | 'opened' | 'submitted' | 'reviewed' | 'expired' | 'cancelled';
  expires_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  created_at: string;
}
export interface ShiftRow {
  id: string;
  org_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  location: EntryLocation;
  project_id: string | null;
  note: string | null;
  status: 'draft' | 'published';
  adopted_entry_id: string | null;
}
export interface ShiftTemplateRow {
  id: string;
  org_id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  location: EntryLocation;
  color: string | null;
}
export interface ApiKeyRow {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// ---- files
export async function listFiles(db: DbClient, orgId: string, userId: string): Promise<FileRow[]> {
  const { rows } = await db.query<FileRow>(`select id, org_id, user_id, kind, filename, mime, size_bytes, sha256, extracted, created_at from zt_files where org_id = $1 and user_id = $2 and deleted_at is null order by created_at`, [orgId, userId]);
  return rows;
}
export async function getFileWithContent(db: DbClient, orgId: string, id: string): Promise<(FileRow & { content: Uint8Array }) | null> {
  const { rows } = await db.query<FileRow & { content: Uint8Array | string }>(`select id, org_id, user_id, kind, filename, mime, size_bytes, sha256, extracted, created_at, content from zt_files where org_id = $1 and id = $2 and deleted_at is null`, [orgId, id]);
  const r = rows[0];
  if (!r) return null;
  const content = typeof r.content === 'string' ? Buffer.from(r.content.replace(/^\\x/, ''), 'hex') : r.content;
  return { ...r, content: new Uint8Array(content) };
}
export async function insertFile(db: DbClient, f: { orgId: string; userId: string | null; kind: DocKind; filename: string; mime: string; content: Uint8Array; sha256: string; extracted?: unknown; via: string }): Promise<FileRow> {
  const { rows } = await db.query<FileRow>(
    `insert into zt_files (org_id, user_id, kind, filename, mime, size_bytes, sha256, content, extracted, uploaded_via) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, org_id, user_id, kind, filename, mime, size_bytes, sha256, extracted, created_at`,
    [f.orgId, f.userId, f.kind, f.filename, f.mime, f.content.length, f.sha256, Buffer.from(f.content), f.extracted == null ? null : JSON.stringify(f.extracted), f.via],
  );
  return rows[0];
}
export async function softDeleteFile(db: DbClient, orgId: string, id: string): Promise<void> {
  await db.query(`update zt_files set deleted_at = now() where org_id = $1 and id = $2`, [orgId, id]);
}

// ---- profiles
export async function getProfile(db: DbClient, orgId: string, userId: string): Promise<ProfileRow | null> {
  const { rows } = await db.query<ProfileRow>(`select * from zt_employee_profiles where org_id = $1 and user_id = $2`, [orgId, userId]);
  return rows[0] ?? null;
}
export async function upsertProfile(db: DbClient, orgId: string, userId: string, patch: { data?: unknown; consents?: unknown; completeness?: number; validation?: unknown; submitted?: boolean }): Promise<ProfileRow> {
  const { rows } = await db.query<ProfileRow>(
    `insert into zt_employee_profiles (user_id, org_id, data, consents, completeness, validation, submitted_at)
     values ($2, $1, coalesce($3::jsonb, '{}'::jsonb), coalesce($4::jsonb, '{}'::jsonb), coalesce($5, 0), coalesce($6::jsonb, '[]'::jsonb), case when $7 then now() else null end)
     on conflict (user_id) do update set
       data = coalesce($3::jsonb, zt_employee_profiles.data),
       consents = coalesce($4::jsonb, zt_employee_profiles.consents),
       completeness = coalesce($5, zt_employee_profiles.completeness),
       validation = coalesce($6::jsonb, zt_employee_profiles.validation),
       submitted_at = case when $7 then now() else zt_employee_profiles.submitted_at end,
       updated_at = now()
     returning *`,
    [orgId, userId, patch.data == null ? null : JSON.stringify(patch.data), patch.consents == null ? null : JSON.stringify(patch.consents), patch.completeness ?? null, patch.validation == null ? null : JSON.stringify(patch.validation), !!patch.submitted],
  );
  return rows[0];
}

// ---- onboarding tokens
export async function createOnboarding(db: DbClient, orgId: string, userId: string, tokenHash: string, createdBy: string | null, days = 14): Promise<OnboardingRow> {
  await db.query(`update zt_onboarding set status = 'cancelled' where org_id = $1 and user_id = $2 and status in ('sent','opened')`, [orgId, userId]);
  const { rows } = await db.query<OnboardingRow>(`insert into zt_onboarding (org_id, user_id, token_hash, expires_at, created_by) values ($1,$2,$3, now() + ($4 || ' days')::interval, $5) returning id, org_id, user_id, status, expires_at, opened_at, submitted_at, created_at`, [orgId, userId, tokenHash, String(days), createdBy]);
  return rows[0];
}
export async function getOnboardingByHash(db: DbClient, tokenHash: string): Promise<OnboardingRow | null> {
  const { rows } = await db.query<OnboardingRow>(`select id, org_id, user_id, status, expires_at, opened_at, submitted_at, created_at from zt_onboarding where token_hash = $1`, [tokenHash]);
  return rows[0] ?? null;
}
export async function latestOnboarding(db: DbClient, orgId: string, userId: string): Promise<OnboardingRow | null> {
  const { rows } = await db.query<OnboardingRow>(`select id, org_id, user_id, status, expires_at, opened_at, submitted_at, created_at from zt_onboarding where org_id = $1 and user_id = $2 order by created_at desc limit 1`, [orgId, userId]);
  return rows[0] ?? null;
}
export async function setOnboardingStatus(db: DbClient, id: string, status: OnboardingRow['status']): Promise<void> {
  await db.query(`update zt_onboarding set status = $2, opened_at = case when $2 = 'opened' and opened_at is null then now() else opened_at end, submitted_at = case when $2 = 'submitted' then now() else submitted_at end where id = $1`, [id, status]);
}
export async function onboardingOverview(db: DbClient, orgId: string): Promise<Array<{ user_id: string; status: string | null; completeness: number | null; submitted_at: string | null; reviewed_at: string | null; sent_to_payroll_at: string | null; expires_at: string | null }>> {
  const { rows } = await db.query<{ user_id: string; status: string | null; completeness: number | null; submitted_at: string | null; reviewed_at: string | null; sent_to_payroll_at: string | null; expires_at: string | null }>(
    `select u.id as user_id, o.status, p.completeness, p.submitted_at, p.reviewed_at, p.sent_to_payroll_at, o.expires_at
       from zt_users u
       left join lateral (select status, expires_at from zt_onboarding where user_id = u.id order by created_at desc limit 1) o on true
       left join zt_employee_profiles p on p.user_id = u.id
      where u.org_id = $1 and u.deleted_at is null`,
    [orgId],
  );
  return rows;
}

// ---- shifts
export async function listShifts(db: DbClient, orgId: string, from: string, to: string, userId?: string): Promise<ShiftRow[]> {
  const params: unknown[] = [orgId, from, to];
  let sql = `select id, org_id, user_id, date, start_time, end_time, break_minutes, location, project_id, note, status, adopted_entry_id from zt_shifts where org_id = $1 and deleted_at is null and date between $2 and $3`;
  if (userId) {
    params.push(userId);
    sql += ` and user_id = $4`;
  }
  const { rows } = await db.query<ShiftRow>(sql + ` order by date, start_time`, params);
  return rows;
}
export async function listTemplates(db: DbClient, orgId: string): Promise<ShiftTemplateRow[]> {
  const { rows } = await db.query<ShiftTemplateRow>(`select * from zt_shift_templates where org_id = $1 order by start_time`, [orgId]);
  return rows;
}

// ---- api keys
export async function listApiKeys(db: DbClient, orgId: string): Promise<ApiKeyRow[]> {
  const { rows } = await db.query<ApiKeyRow>(`select id, org_id, name, key_prefix, scopes, created_at, last_used_at, revoked_at from zt_api_keys where org_id = $1 order by created_at desc`, [orgId]);
  return rows;
}
export async function findApiKey(db: DbClient, keyHash: string): Promise<(ApiKeyRow & { time_zone: string }) | null> {
  const { rows } = await db.query<ApiKeyRow & { time_zone: string }>(`select k.id, k.org_id, k.name, k.key_prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at, o.time_zone from zt_api_keys k join zt_orgs o on o.id = k.org_id where k.key_hash = $1 and k.revoked_at is null and o.deleted_at is null`, [keyHash]);
  const r = rows[0];
  if (r) db.query(`update zt_api_keys set last_used_at = now() where id = $1`, [r.id]).catch(() => undefined);
  return r ?? null;
}
