import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp, hasRole } from '@/lib/auth';
import { ApiError, fail, handler, json, parseBody, unauthorized } from '@/lib/api';
import { audit } from '@/lib/audit';
import type { UserRow } from '@/lib/org';

export const dynamic = 'force-dynamic';

const employmentSchema = z.object({
  weeklyMinutes: z.number().int().min(0).max(3600),
  workDays: z.array(z.number().int().min(1).max(7)).min(0).max(7),
  dailyPattern: z.record(z.string(), z.number().int().min(0).max(720)).optional(),
  recordMode: z.enum(['full', 'duration_only']),
  gleitzeit: z.boolean(),
  vacationDaysPerYear: z.number().min(0).max(60),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  openingBalanceMinutes: z.number().int().min(-60000).max(60000),
  allIn: z.boolean(),
  azgExempt: z.boolean().optional(),
  teleworkAgreement: z.boolean().optional(),
  targetMode: z.enum(['contract', 'plan']).optional(),
  autoAdoptPlan: z.boolean().optional(),
});

const createSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(1).max(120),
  role: z.enum(['owner', 'admin', 'manager', 'payroll', 'employee']),
  personnelNo: z.string().max(40).nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  employment: employmentSchema,
  sendInvite: z.boolean().default(true),
  sendOnboarding: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const b = await parseBody(req, createSchema);
  if (b.role === 'owner' && s.user.role !== 'owner') throw new ApiError(403, 'Nur Inhaber:innen können weitere Inhaber:innen anlegen.');
  const db = await getDb();
  const email = b.email.trim().toLowerCase();
  const dup = await db.query(`select 1 from zt_users where org_id = $1 and email = $2 and deleted_at is null`, [s.org.id, email]);
  if (dup.rows.length) throw new ApiError(409, 'Diese E-Mail-Adresse ist bereits angelegt.');
  const { rows } = await db.query<UserRow>(
    `insert into zt_users (org_id, email, name, role, personnel_no, manager_id, employment, invited_at) values ($1,$2,$3,$4,$5,$6,$7, now()) returning *`,
    [s.org.id, email, b.name.trim(), b.role, b.personnelNo?.trim() || null, b.managerId ?? null, JSON.stringify(b.employment)],
  );
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'user.create', 'user', rows[0].id, null, { ...rows[0], employment: b.employment });
  if (b.sendOnboarding && b.role !== 'payroll') {
    const { sendOnboardingInvite } = await import('@/lib/onboarding');
    const r = await sendOnboardingInvite(db, s.org, rows[0], { id: s.user.id, email: s.user.email, ip: clientIp() });
    return json({ user: rows[0], onboardingLink: r.link }, { status: 201 });
  }
  if (b.sendInvite) {
    const { sendLoginInvite } = await import('@/lib/invite');
    await sendLoginInvite(db, s.org, rows[0], s.user.name);
  }
  return json({ user: rows[0] }, { status: 201 });
});

const patchSchema = createSchema.partial().extend({ id: z.string().uuid(), active: z.boolean().optional() });

export const PATCH = handler(async (req) => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const b = await parseBody(req, patchSchema);
  const db = await getDb();
  const { rows: beforeRows } = await db.query<UserRow>(`select * from zt_users where org_id = $1 and id = $2 and deleted_at is null`, [s.org.id, b.id]);
  const before = beforeRows[0];
  if (!before) return fail(404, 'Mitarbeiter nicht gefunden.');
  if ((before.role === 'owner' || b.role === 'owner') && s.user.role !== 'owner') throw new ApiError(403, 'Inhaber-Konten können nur von Inhaber:innen geändert werden.');
  if (b.id === s.user.id && b.active === false) throw new ApiError(400, 'Du kannst dich nicht selbst deaktivieren.');
  const sets: string[] = [];
  const params: unknown[] = [s.org.id, b.id];
  const add = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (b.email) add('email', b.email.trim().toLowerCase());
  if (b.name) add('name', b.name.trim());
  if (b.role) add('role', b.role);
  if (b.personnelNo !== undefined) add('personnel_no', b.personnelNo?.trim() || null);
  if (b.managerId !== undefined) add('manager_id', b.managerId);
  if (b.employment) add('employment', JSON.stringify(b.employment));
  if (b.active !== undefined) add('active', b.active);
  if (!sets.length) return json({ user: before });
  sets.push('updated_at = now()');
  const { rows } = await db.query<UserRow>(`update zt_users set ${sets.join(', ')} where org_id = $1 and id = $2 returning *`, params);
  if (b.active === false) await db.query(`delete from zt_sessions where user_id = $1`, [b.id]);
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'user.update', 'user', b.id, before, rows[0]);
  return json({ user: rows[0] });
});
