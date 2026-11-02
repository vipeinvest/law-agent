import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp, hasRole } from '@/lib/auth';
import { fail, handler, unauthorized } from '@/lib/api';
import { evaluateOrgMonth, fileSafe } from '@/lib/export/common';
import { buildPayrollCsv, buildPayrollXlsx, buildProjectsXlsx } from '@/lib/export/payroll-xlsx';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  if (!hasRole(s.user, 'manager') && s.user.role !== 'payroll') return fail(403, 'Keine Berechtigung.');
  const url = new URL(req.url);
  const q = z.object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12), format: z.enum(['xlsx', 'csv', 'projects']).default('xlsx'), users: z.string().optional() }).safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return fail(400, 'year/month erforderlich.');
  const db = await getDb();
  const userIds = q.data.users ? q.data.users.split(',').filter(Boolean) : undefined;
  const data = await evaluateOrgMonth(db, s, q.data.year, q.data.month, userIds);
  const stem = `${fileSafe(s.org.name)}_${q.data.year}-${String(q.data.month).padStart(2, '0')}`;
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, `export.${q.data.format}`, 'period', null, null, { year: q.data.year, month: q.data.month, users: data.employees.length });
  if (q.data.format === 'csv') {
    return new Response(buildPayrollCsv(s.org, data), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="Lohnarten_${stem}.csv"`, 'cache-control': 'no-store' } });
  }
  const buf = q.data.format === 'projects' ? await buildProjectsXlsx(s.org, data) : await buildPayrollXlsx(s.org, data);
  return new Response(Buffer.from(buf), {
    headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${q.data.format === 'projects' ? 'Projekte' : 'Lohnverrechnung'}_${stem}.xlsx"`, 'cache-control': 'no-store' },
  });
});
