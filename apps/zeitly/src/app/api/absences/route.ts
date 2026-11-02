import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp, hasRole } from '@/lib/auth';
import { ApiError, fail, handler, json, parseBody, unauthorized } from '@/lib/api';
import { audit } from '@/lib/audit';
import { insertAbsence, listAbsences } from '@/lib/repo';
import { resolveTargetUser } from '@/lib/entries';
import { sendMail, layout, escapeHtml } from '@/lib/mail';
import { ABSENCE_LABELS, fmtDate } from '@/lib/format';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const url = new URL(req.url);
  const q = z.object({ from: z.string(), to: z.string(), userId: z.string().uuid().optional() }).safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return fail(400, 'from/to erforderlich.');
  const db = await getDb();
  return json({ absences: await listAbsences(db, s.org.id, resolveTargetUser(s, q.data.userId), q.data.from, q.data.to) });
});

const schema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['vacation', 'sick', 'time_comp', 'special_leave', 'care_leave', 'training', 'unpaid', 'other']),
  halfDay: z.boolean().default(false),
  note: z.string().max(500).nullable().optional(),
  userId: z.string().uuid().optional(),
});

export const POST = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const b = await parseBody(req, schema);
  if (b.dateTo < b.dateFrom) throw new ApiError(400, 'Das Ende liegt vor dem Beginn.');
  if (b.halfDay && b.dateFrom !== b.dateTo) throw new ApiError(400, 'Halbe Tage nur bei eintägigen Abwesenheiten.');
  const db = await getDb();
  const userId = resolveTargetUser(s, b.userId);
  const byManager = userId !== s.user.id && hasRole(s.user, 'manager');
  // sick leave is a notification, not a request → auto-approved; managers' own bookings are approved
  const status = byManager || b.type === 'sick' ? 'approved' : 'requested';
  const row = await insertAbsence(db, s.org.id, userId, s.user.id, { dateFrom: b.dateFrom, dateTo: b.dateTo, type: b.type, halfDay: b.halfDay, note: b.note?.trim() || null, status });
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'absence.create', 'absence', row.id, null, row);
  if (status === 'requested') {
    // notify manager/admins
    const { rows } = await db.query<{ email: string; name: string }>(
      `select email, name from zt_users where org_id = $1 and active and deleted_at is null and (id = $2 or (role in ('admin','owner') and $2 is null)) limit 5`,
      [s.org.id, s.user.manager_id],
    );
    for (const m of rows) {
      const text = `${s.user.name} beantragt ${ABSENCE_LABELS[b.type]} von ${fmtDate(b.dateFrom)} bis ${fmtDate(b.dateTo)}${b.halfDay ? ' (halber Tag)' : ''}.${b.note ? `\nNotiz: ${b.note}` : ''}\n\nFreigeben: ${env.appUrl}/admin/freigaben`;
      await sendMail({ to: m.email, subject: `Antrag: ${ABSENCE_LABELS[b.type]} ${s.user.name}`, text, html: layout('Neuer Abwesenheitsantrag', `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`, { name: s.org.name, color: (s.org.theme as { primary?: string })?.primary }), template: 'absence_request', orgId: s.org.id });
    }
  }
  return json({ absence: row }, { status: 201 });
});
