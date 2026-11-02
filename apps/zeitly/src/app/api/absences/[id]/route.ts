import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp, hasRole } from '@/lib/auth';
import { ApiError, handler, json, parseBody, unauthorized } from '@/lib/api';
import { audit } from '@/lib/audit';
import { decideAbsence, softDeleteAbsence, type AbsenceRow } from '@/lib/repo';
import { assertPeriodEditable } from '@/lib/entries';
import { layout, sendMail, escapeHtml } from '@/lib/mail';
import { ABSENCE_LABELS, fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function load(db: Awaited<ReturnType<typeof getDb>>, orgId: string, id: string): Promise<AbsenceRow> {
  const { rows } = await db.query<AbsenceRow>(`select * from zt_absences where org_id = $1 and id = $2 and deleted_at is null`, [orgId, id]);
  if (!rows[0]) throw new ApiError(404, 'Abwesenheit nicht gefunden.');
  return rows[0];
}

export const PATCH = handler(async (req, { params }) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  if (!hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  const { status } = await parseBody(req, z.object({ status: z.enum(['approved', 'rejected']) }));
  const db = await getDb();
  const before = await load(db, s.org.id, params.id);
  if (before.user_id === s.user.id && !hasRole(s.user, 'admin')) throw new ApiError(403, 'Eigene Anträge können nicht selbst entschieden werden.');
  const row = await decideAbsence(db, s.org.id, params.id, s.user.id, status);
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, `absence.${status}`, 'absence', params.id, before, row);
  const { rows } = await db.query<{ email: string; name: string }>(`select email, name from zt_users where id = $1`, [before.user_id]);
  if (rows[0]) {
    const text = `Dein Antrag auf ${ABSENCE_LABELS[before.type]} (${fmtDate(before.date_from)} – ${fmtDate(before.date_to)}) wurde ${status === 'approved' ? 'genehmigt' : 'abgelehnt'}.`;
    await sendMail({ to: rows[0].email, subject: `${ABSENCE_LABELS[before.type]} ${status === 'approved' ? 'genehmigt' : 'abgelehnt'}`, text, html: layout('Antrag entschieden', `<p>${escapeHtml(text)}</p>`, { name: s.org.name }), template: 'absence_decision', orgId: s.org.id });
  }
  return json({ absence: row });
});

export const DELETE = handler(async (_req, { params }) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const db = await getDb();
  const before = await load(db, s.org.id, params.id);
  const own = before.user_id === s.user.id;
  if (!own && !hasRole(s.user, 'manager')) throw new ApiError(403, 'Keine Berechtigung.');
  if (own && before.status !== 'requested' && !hasRole(s.user, 'manager')) throw new ApiError(409, 'Genehmigte Abwesenheiten können nur von Vorgesetzten entfernt werden.');
  await assertPeriodEditable(db, s, before.user_id, before.date_from);
  await softDeleteAbsence(db, s.org.id, params.id);
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'absence.delete', 'absence', params.id, before, null);
  return json({ ok: true });
});
