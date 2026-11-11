import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { ApiError, handler, json, parseBody, unauthorized } from '@/lib/api';
import { audit } from '@/lib/audit';
import type { OrgRow } from '@/lib/org';

export const dynamic = 'force-dynamic';

const rulesSchema = z
  .object({
    normalDailyMinutes: z.number().int().min(60).max(720),
    normalWeeklyMinutes: z.number().int().min(60).max(3600),
    maxDailyMinutes: z.number().int().min(480).max(720),
    maxWeeklyMinutes: z.number().int().min(2400).max(3600),
    breakAfterMinutes: z.number().int().min(60).max(360),
    minBreakMinutes: z.number().int().min(15).max(120),
    minDailyRestMinutes: z.number().int().min(480).max(720),
    overtimeThresholdDailyMinutes: z.number().int().min(60).max(720),
    overtimeThresholdWeeklyMinutes: z.number().int().min(60).max(3600),
    fullTimeWeeklyMinutes: z.number().int().min(60).max(3600),
    roundingMinutes: z.union([z.literal(0), z.literal(1), z.literal(5), z.literal(10), z.literal(15)]),
    fixedBreakAgreement: z.boolean(),
    autoBreakDeduction: z.boolean(),
    travelCountsAsWork: z.boolean(),
    extraHolidays: z.record(z.string().regex(/^\d{2}-\d{2}$/), z.number().min(0).max(1)),
    defaultWorkDays: z.array(z.number().int().min(1).max(7)),
    nightStart: z.string().regex(/^\d{2}:\d{2}$/),
    nightEnd: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .partial();

const themeSchema = z
  .object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logoDataUrl: z.string().max(200_000).regex(/^data:image\/(png|jpeg|svg\+xml|webp);base64,/).nullable(),
    logoText: z.string().max(40).nullable(),
    appName: z.string().max(40).nullable(),
    radius: z.enum(['soft', 'round', 'square']),
  })
  .partial();

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  legalName: z.string().max(200).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  uidNumber: z.string().max(30).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  payrollEmail: z.string().email().nullable().optional(),
  timeZone: z.string().max(60).optional(),
  rules: rulesSchema.optional(),
  theme: themeSchema.optional(),
  payrollCodes: z.record(z.string(), z.object({ code: z.string().max(20), label: z.string().max(80) })).optional(),
  /** Wochenbudget Personalkosten in EUR (Dienstplan); null löscht das Budget. */
  laborBudgetWeekly: z.number().min(0).max(10_000_000).nullable().optional(),
});

export const PATCH = handler(async (req) => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const b = await parseBody(req, schema);
  const db = await getDb();
  const { rows: before } = await db.query<OrgRow>(`select * from zt_orgs where id = $1`, [s.org.id]);
  const org = before[0];
  if (!org) throw new ApiError(404, 'Organisation nicht gefunden.');
  if (b.timeZone) {
    try {
      new Intl.DateTimeFormat('de-AT', { timeZone: b.timeZone });
    } catch {
      throw new ApiError(400, 'Ungültige Zeitzone.');
    }
  }
  const settings = { ...(org.settings || {}), ...(b.rules || {}), ...(b.payrollCodes ? { payrollCodes: b.payrollCodes } : {}), ...(b.laborBudgetWeekly !== undefined ? { laborBudgetWeekly: b.laborBudgetWeekly } : {}) };
  const theme = { ...(org.theme || {}), ...(b.theme || {}) };
  const { rows } = await db.query<OrgRow>(
    `update zt_orgs set name = coalesce($2, name), legal_name = case when $3::boolean then $4 else legal_name end, address = case when $5::boolean then $6 else address end, uid_number = case when $7::boolean then $8 else uid_number end,
       contact_email = case when $9::boolean then $10 else contact_email end, payroll_email = case when $11::boolean then $12 else payroll_email end, time_zone = coalesce($13, time_zone), settings = $14, theme = $15, updated_at = now() where id = $1 returning *`,
    [s.org.id, b.name ?? null, b.legalName !== undefined, b.legalName ?? null, b.address !== undefined, b.address ?? null, b.uidNumber !== undefined, b.uidNumber ?? null, b.contactEmail !== undefined, b.contactEmail ?? null, b.payrollEmail !== undefined, b.payrollEmail ?? null, b.timeZone ?? null, JSON.stringify(settings), JSON.stringify(theme)],
  );
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'org.update', 'org', s.org.id, { ...org, theme: { ...org.theme, logoDataUrl: org.theme?.logoDataUrl ? '[logo]' : null } }, { ...b, theme: b.theme ? { ...b.theme, logoDataUrl: b.theme.logoDataUrl ? '[logo]' : b.theme.logoDataUrl } : undefined });
  return json({ org: rows[0] });
});
