import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { ApiError, handler, json, parseBody, unauthorized } from '@/lib/api';
import { audit } from '@/lib/audit';
import type { ProjectRow } from '@/lib/repo';

export const dynamic = 'force-dynamic';

const schema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(120),
  customer: z.string().max(120).nullable().optional(),
  costCenter: z.string().max(40).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  billable: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const b = await parseBody(req, schema);
  const db = await getDb();
  const code = b.code.trim().toUpperCase();
  if (b.id) {
    const { rows: before } = await db.query<ProjectRow>(`select * from zt_projects where org_id = $1 and id = $2`, [s.org.id, b.id]);
    if (!before[0]) throw new ApiError(404, 'Projekt nicht gefunden.');
    const { rows } = await db.query<ProjectRow>(`update zt_projects set code = $3, name = $4, customer = $5, cost_center = $6, color = $7, billable = $8, active = $9, updated_at = now() where org_id = $1 and id = $2 returning *`, [s.org.id, b.id, code, b.name.trim(), b.customer || null, b.costCenter || null, b.color || null, b.billable, b.active]);
    await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'project.update', 'project', b.id, before[0], rows[0]);
    return json({ project: rows[0] });
  }
  const dup = await db.query(`select 1 from zt_projects where org_id = $1 and code = $2`, [s.org.id, code]);
  if (dup.rows.length) throw new ApiError(409, 'Kürzel bereits vergeben.');
  const { rows } = await db.query<ProjectRow>(`insert into zt_projects (org_id, code, name, customer, cost_center, color, billable, active) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [s.org.id, code, b.name.trim(), b.customer || null, b.costCenter || null, b.color || null, b.billable, b.active]);
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'project.create', 'project', rows[0].id, null, rows[0]);
  return json({ project: rows[0] }, { status: 201 });
});
