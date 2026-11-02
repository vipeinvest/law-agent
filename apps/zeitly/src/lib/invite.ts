import 'server-only';
import type { DbClient } from '@/db/client';
import { env } from './env';
import { escapeHtml, layout, sendMail } from './mail';
import type { OrgRow, UserRow } from './org';

/** Login invitation (shared by admin "Mitarbeiter anlegen" and the production seed). */
export async function sendLoginInvite(db: DbClient, org: OrgRow, user: UserRow, senderName: string): Promise<void> {
  void db;
  const appName = (org.theme as { appName?: string })?.appName || 'Zeitly';
  const link = `${env.appUrl}/login?org=${encodeURIComponent(org.slug)}`;
  const text = `Hallo ${user.name},\n\n${org.name} erfasst Arbeitszeiten ab sofort mit ${appName}.\n\nSo meldest du dich an:\n1. ${link} öffnen (am Handy gern zum Startbildschirm hinzufügen)\n2. Deine E-Mail-Adresse ${user.email} eingeben\n3. Den 6-stelligen Code aus der E-Mail eintippen – fertig, kein Passwort nötig.\n\nDeine Daten bleiben nur für dich und deine Führungskraft sichtbar. Informationen zum Datenschutz findest du in der App unter Profil.\n\nViele Grüße\n${senderName}`;
  await sendMail({
    to: user.email,
    subject: `Einladung: Zeiterfassung ${appName}`,
    text,
    html: layout(`Willkommen bei ${appName}`, `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p><p><a href="${link}" style="display:inline-block;padding:10px 16px;background:${(org.theme as { primary?: string })?.primary || '#1f5f5b'};color:#fff;border-radius:8px;text-decoration:none">Jetzt anmelden</a></p>`, { name: appName, color: (org.theme as { primary?: string })?.primary }),
    template: 'invite',
    orgId: org.id,
  });
}
