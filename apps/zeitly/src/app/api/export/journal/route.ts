import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp, hasRole, sessionContext } from '@/lib/auth';
import { fail, handler, unauthorized } from '@/lib/api';
import { evaluateUserMonth } from '@/lib/period';
import { getUser, listProjects } from '@/lib/repo';
import { buildJournalPdf, type JournalInput } from '@/lib/export/journal-pdf';
import { evaluateOrgMonth, fileSafe } from '@/lib/export/common';
import { orgRules, userEmployment } from '@/lib/org';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const url = new URL(req.url);
  const q = z.object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12), userId: z.string().uuid().optional(), all: z.string().optional() }).safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return fail(400, 'year/month erforderlich.');
  const db = await getDb();
  const rules = orgRules(s.org);
  const inputs: JournalInput[] = [];
  if (q.data.all === '1') {
    if (!hasRole(s.user, 'manager') && s.user.role !== 'payroll') return fail(403, 'Keine Berechtigung.');
    const data = await evaluateOrgMonth(db, s, q.data.year, q.data.month);
    for (const e of data.employees) inputs.push({ org: s.org, user: e.user, summary: e.summary, period: e.period, projects: data.projects, weeklyMinutes: e.weeklyMinutes, recordMode: userEmployment(e.user, rules).recordMode });
  } else {
    const userId = q.data.userId && q.data.userId !== s.user.id ? q.data.userId : s.user.id;
    if (userId !== s.user.id && !hasRole(s.user, 'manager') && s.user.role !== 'payroll') return fail(403, 'Keine Berechtigung.');
    const user = userId === s.user.id ? s.user : await getUser(db, s.org.id, userId);
    if (!user) return fail(404, 'Mitarbeiter nicht gefunden.');
    const { summary, period } = await evaluateUserMonth(db, s.org, user, q.data.year, q.data.month);
    const projects = await listProjects(db, s.org.id, false);
    let approverName: string | null = null;
    if (period?.approved_by) approverName = (await getUser(db, s.org.id, period.approved_by))?.name ?? null;
    const { employment } = sessionContext({ ...s, user });
    inputs.push({ org: s.org, user, summary, period, projects, weeklyMinutes: employment.weeklyMinutes, recordMode: employment.recordMode, approverName });
  }
  if (inputs.length === 0) return fail(404, 'Keine Mitarbeiter.');
  const pdf = await buildJournalPdf(inputs);
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'export.journal', 'period', null, null, { year: q.data.year, month: q.data.month, users: inputs.map((i) => i.user.id) });
  const name = inputs.length === 1 ? `Arbeitszeitnachweis_${fileSafe(inputs[0].user.name)}_${q.data.year}-${String(q.data.month).padStart(2, '0')}.pdf` : `Arbeitszeitnachweise_${fileSafe(s.org.name)}_${q.data.year}-${String(q.data.month).padStart(2, '0')}.pdf`;
  return new Response(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `${url.searchParams.get('inline') ? 'inline' : 'attachment'}; filename="${name}"`, 'cache-control': 'no-store' } });
});
