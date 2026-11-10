import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { ApiError, handler, json, parseBody, unauthorized } from '@/lib/api';
import { getUser } from '@/lib/repo';
import { loadOnboardingForAdmin, markReviewed, markSentToPayroll, sendOnboardingInvite } from '@/lib/onboarding';
import { buildPersonnelSheetPdf } from '@/lib/export/personnel-pdf';
import { escapeHtml, layout, sendMail } from '@/lib/mail';
import { fileSafe } from '@/lib/export/common';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['invite', 'review', 'send_payroll', 'pdf']),
  message: z.string().max(1000).optional(),
  to: z.string().email().optional(),
});

export const POST = handler(async (req) => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const b = await parseBody(req, schema);
  const db = await getDb();
  const actor = { id: s.user.id, email: s.user.email, ip: clientIp() };
  const user = await getUser(db, s.org.id, b.userId);
  if (!user) throw new ApiError(404, 'Mitarbeiter nicht gefunden.');
  switch (b.action) {
    case 'invite': {
      const r = await sendOnboardingInvite(db, s.org, user, actor, { message: b.message ?? null });
      return json({ ok: true, link: r.link, expiresAt: r.onboarding.expires_at });
    }
    case 'review':
      await markReviewed(db, s.org, user.id, actor);
      return json({ ok: true });
    case 'send_payroll': {
      const to = b.to || s.org.payroll_email;
      if (!to) throw new ApiError(400, 'Keine Adresse der Lohnverrechnung hinterlegt.');
      const { profile, files } = await loadOnboardingForAdmin(db, s.org, user.id);
      if (!profile?.submitted_at) throw new ApiError(400, 'Der Fragebogen wurde noch nicht abgesendet.');
      const pdf = await buildPersonnelSheetPdf(s.org, user, profile, files);
      const start = (profile.data as { employment?: { startDate?: string } }).employment?.startDate;
      const name = `Personalstammblatt_${fileSafe(user.name)}.pdf`;
      const text = `Sehr geehrte Damen und Herren,\n\nanbei das Personalstammblatt und die ÖGK-Mindestangaben für den Neueintritt ${user.name}${start ? ` (Eintritt ${fmtDate(start)})` : ''} bei ${s.org.legal_name || s.org.name}.\n\nBitte die Mindestangaben-Anmeldung vor Arbeitsantritt per ELDA durchführen und die vollständige Anmeldung binnen 7 Tagen. Dokumente (Ausweis, e-card, Meldezettel …) sind in Fairhours hinterlegt und werden auf Anfrage bereitgestellt.\n\nMit freundlichen Grüßen\n${s.user.name}\n${s.org.name}`;
      const res = await sendMail({ to, subject: `Neueintritt ${user.name}${start ? ' ab ' + fmtDate(start) : ''} – Personalstammblatt & ÖGK-Mindestangaben`, text, html: layout(`Neueintritt ${user.name}`, `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(text)}</pre>`, { name: s.org.name, color: (s.org.theme as { primary?: string })?.primary }), template: 'onboarding_payroll', orgId: s.org.id, attachments: [{ filename: name, content: pdf }], replyTo: s.user.email });
      if (!res.ok) throw new ApiError(502, `Versand fehlgeschlagen: ${res.error}`);
      await markSentToPayroll(db, s.org, user.id, actor, to, [name]);
      return json({ ok: true, to, preview: !!res.previewText });
    }
    case 'pdf': {
      const { profile, files } = await loadOnboardingForAdmin(db, s.org, user.id);
      if (!profile) throw new ApiError(400, 'Noch keine Daten vorhanden.');
      const pdf = await buildPersonnelSheetPdf(s.org, user, profile, files);
      return new Response(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="Personalstammblatt_${fileSafe(user.name)}.pdf"`, 'cache-control': 'no-store' } });
    }
  }
});
