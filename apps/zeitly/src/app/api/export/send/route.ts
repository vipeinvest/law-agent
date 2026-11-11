import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp, hasRole } from '@/lib/auth';
import { fail, handler, json, parseBody, unauthorized } from '@/lib/api';
import { evaluateOrgMonth, fileSafe } from '@/lib/export/common';
import { buildPayrollXlsx, buildProjectsXlsx } from '@/lib/export/payroll-xlsx';
import { buildJournalPdf } from '@/lib/export/journal-pdf';
import { orgRules, userEmployment } from '@/lib/org';
import { escapeHtml, layout, sendMail } from '@/lib/mail';
import { fmtMonth } from '@/lib/format';
import { audit } from '@/lib/audit';
import { markExported } from '@/lib/periods';
import { formatMinutes } from '@/domain/time';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  if (!hasRole(s.user, 'manager') && s.user.role !== 'payroll') return fail(403, 'Keine Berechtigung.');
  const b = await parseBody(req, z.object({ year: z.number().int(), month: z.number().int().min(1).max(12), to: z.string().email().optional(), includeJournals: z.boolean().default(true), includeProjects: z.boolean().default(false), markExported: z.boolean().default(true), message: z.string().max(2000).optional() }));
  const to = b.to || s.org.payroll_email;
  if (!to) return fail(400, 'Keine Empfängeradresse (Lohnverrechnung) hinterlegt.');
  const db = await getDb();
  const data = await evaluateOrgMonth(db, s, b.year, b.month);
  const notApproved = data.employees.filter((e) => !e.period || (e.period.status !== 'approved' && e.period.status !== 'exported'));
  const stem = `${fileSafe(s.org.name)}_${b.year}-${String(b.month).padStart(2, '0')}`;
  const attachments: Array<{ filename: string; content: Uint8Array }> = [{ filename: `Lohnverrechnung_${stem}.xlsx`, content: await buildPayrollXlsx(s.org, data) }];
  if (b.includeJournals) {
    const rules = orgRules(s.org);
    attachments.push({ filename: `Arbeitszeitnachweise_${stem}.pdf`, content: await buildJournalPdf(data.employees.map((e) => ({ org: s.org, user: e.user, summary: e.summary, period: e.period, projects: data.projects, weeklyMinutes: e.weeklyMinutes, recordMode: userEmployment(e.user, rules).recordMode }))) });
  }
  if (b.includeProjects) attachments.push({ filename: `Projekte_${stem}.xlsx`, content: await buildProjectsXlsx(s.org, data) });
  const label = fmtMonth(b.year, b.month);
  const summaryLines = data.employees.map((e) => `- ${e.user.name}${e.user.personnel_no ? ' (' + e.user.personnel_no + ')' : ''}: Ist ${formatMinutes(e.summary.workedMinutes)} h, Soll ${formatMinutes(e.summary.targetMinutes)} h, ÜSt ${formatMinutes(e.summary.overtimeMinutes)} h, Urlaub ${e.summary.absenceDays.vacation} T, KS ${e.summary.absenceDays.sick} T, Saldo ${formatMinutes(e.summary.balanceEndMinutes, { sign: true })} h${e.period && (e.period.status === 'approved' || e.period.status === 'exported') ? '' : ' [nicht freigegeben]'}`);
  const text = `Sehr geehrte Damen und Herren,\n\nanbei die Arbeitszeitdaten von ${s.org.legal_name || s.org.name} für ${label}.\n\n${b.message ? b.message + '\n\n' : ''}Übersicht:\n${summaryLines.join('\n')}\n${notApproved.length ? `\nHinweis: ${notApproved.length} Monat(e) sind noch nicht freigegeben und können sich noch ändern.\n` : ''}\nAnhänge: ${attachments.map((a) => a.filename).join(', ')}\n\nMit freundlichen Grüßen\n${s.user.name}\n${s.org.name}`;
  const res = await sendMail({ to, subject: `Arbeitszeitdaten ${label} – ${s.org.name}`, text, html: layout(`Arbeitszeitdaten ${label}`, `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(text)}</pre>`, { name: s.org.name, color: (s.org.theme as { primary?: string })?.primary }), template: 'payroll_export', orgId: s.org.id, attachments, replyTo: s.user.email });
  if (!res.ok) return fail(502, `Versand fehlgeschlagen: ${res.error}`);
  await audit(db, { id: s.user.id, email: s.user.email, ip: clientIp() }, s.org.id, 'export.send', 'period', null, null, { year: b.year, month: b.month, to, attachments: attachments.map((a) => a.filename) });
  let exported = 0;
  if (b.markExported) exported = await markExported(db, s, { id: s.user.id, email: s.user.email, ip: clientIp() }, b.year, b.month, data.employees.filter((e) => e.period?.status === 'approved').map((e) => e.user.id));
  return json({ ok: true, to, attachments: attachments.map((a) => a.filename), exported, notApproved: notApproved.length, preview: res.previewText ? true : false });
});
