import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Profile } from '@/domain/onboarding';
import { oegkMinimalRegistration, validateSvNumber } from '@/domain/onboarding';
import { ABSENCE_LABELS, fmtDate, fmtDateTime } from '../format';
import type { OrgRow, UserRow } from '../org';
import { hexToRgb } from '../org';
import type { FileRow, ProfileRow } from '../repo-v2';
import { DOC_LABELS } from '@/domain/onboarding';

void ABSENCE_LABELS;

const A4: [number, number] = [595.28, 841.89];
const M = 44;
const safe = (s: string) => s.replace(/Λ/g, 'A').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“„”]/g, '"').replace(/[^\x00-\xff]/g, '?');

const GENDER: Record<string, string> = { w: 'weiblich', m: 'männlich', d: 'divers', k: 'keine Angabe' };
const MARITAL: Record<string, string> = { ledig: 'ledig', verheiratet: 'verheiratet', eingetragene_partnerschaft: 'eingetragene Partnerschaft', geschieden: 'geschieden', verwitwet: 'verwitwet', lebensgemeinschaft: 'Lebensgemeinschaft' };

/** Personalstammblatt (für die Lohnverrechnung) + ÖGK-Mindestangaben auf Seite 2. */
export async function buildPersonnelSheetPdf(org: OrgRow, user: UserRow, profile: ProfileRow, files: FileRow[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const p = profile.data as Profile;
  const brandRgb = hexToRgb((org.theme as { primary?: string })?.primary || '#1f5f5b') ?? [31, 95, 91];
  const brand = rgb(brandRgb[0] / 255, brandRgb[1] / 255, brandRgb[2] / 255);
  doc.setTitle(`Personalstammblatt ${user.name}`);
  doc.setCreator('Fairhours');

  let page = doc.addPage(A4);
  let y = A4[1] - M;
  const header = (title: string) => {
    page.drawRectangle({ x: 0, y: A4[1] - 26, width: A4[0], height: 26, color: brand });
    page.drawText(safe(org.legal_name || org.name), { x: M, y: A4[1] - 17, size: 10, font: bold, color: rgb(1, 1, 1) });
    page.drawText(safe(title), { x: A4[0] - M - bold.widthOfTextAtSize(safe(title), 9), y: A4[1] - 17, size: 9, font: bold, color: rgb(1, 1, 1) });
    y = A4[1] - 52;
  };
  const footer = (n: number) => page.drawText(safe(`${org.name} · ${user.name} · erstellt ${fmtDateTime(new Date().toISOString(), org.time_zone)} mit Fairhours · vertraulich – nur für Personalverwaltung und Lohnverrechnung · Seite ${n}`), { x: M, y: 22, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
  const section = (t: string) => {
    y -= 6;
    page.drawText(safe(t), { x: M, y, size: 10.5, font: bold, color: brand });
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.6, color: brand });
    y -= 13;
  };
  const row = (k: string, v: string | number | null | undefined, k2?: string, v2?: string | number | null | undefined) => {
    page.drawText(safe(k), { x: M, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(safe(String(v ?? '–')), { x: M + 120, y, size: 9, font: bold });
    if (k2) {
      page.drawText(safe(k2), { x: M + 270, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(safe(String(v2 ?? '–')), { x: M + 385, y, size: 9, font: bold });
    }
    y -= 14;
  };

  header('Personalstammblatt');
  page.drawText(safe(`Personalstammblatt – ${user.name}`), { x: M, y, size: 16, font: bold });
  y -= 16;
  page.drawText(safe(`Personalnummer ${user.personnel_no || '–'} · erhoben per Onboarding-Fragebogen am ${profile.submitted_at ? fmtDateTime(profile.submitted_at, org.time_zone) : '–'} · Vollständigkeit ${profile.completeness} %`), { x: M, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) });
  y -= 10;

  section('1. Person');
  row('Vorname', `${p.person?.title ? p.person.title + ' ' : ''}${p.person?.firstName ?? ''}`, 'Nachname', p.person?.lastName);
  row('Geburtsdatum', p.person?.birthDate ? fmtDate(p.person.birthDate) : null, 'Geburtsort', p.person?.birthPlace);
  const sv = p.person?.svNumber ? validateSvNumber(p.person.svNumber) : null;
  row('SV-Nummer', p.person?.svNumber ? `${p.person.svNumber.slice(0, 4)} ${p.person.svNumber.slice(4)}${sv && !sv.ok ? ' (!)' : ''}` : null, 'Staatsbürgerschaft', p.person?.nationality);
  row('Geschlecht', p.person?.gender ? GENDER[p.person.gender] : null, 'Familienstand', p.person?.maritalStatus ? MARITAL[p.person.maritalStatus] : null);

  section('2. Kontakt');
  row('Adresse', `${p.contact?.street ?? ''}, ${p.contact?.zip ?? ''} ${p.contact?.city ?? ''}`, 'Land', p.contact?.country);
  row('Telefon', p.contact?.phone, 'Private E-Mail', p.contact?.privateEmail);
  row('Dienstliche E-Mail', user.email, 'Notfallkontakt', p.contact?.emergencyName ? `${p.contact.emergencyName} ${p.contact.emergencyPhone ?? ''}` : null);

  section('3. Bankverbindung');
  row('IBAN', p.bank?.iban?.replace(/(.{4})/g, '$1 ').trim(), 'BIC', p.bank?.bic);
  row('Kontoinhaber:in', p.bank?.accountHolder || `${p.person?.firstName ?? ''} ${p.person?.lastName ?? ''}`);

  section('4. Beschäftigung');
  row('Eintritt', p.employment?.startDate ? fmtDate(p.employment.startDate) : null, 'Wochenstunden', p.employment?.weeklyHours != null ? String(p.employment.weeklyHours).replace('.', ',') : null);
  row('Tätigkeit', p.employment?.jobTitle, 'Ausbildung', p.employment?.education);
  row('Vordienstzeiten', p.employment?.previousServiceNote, 'Erste Beschäftigung in AT', p.employment?.firstJobInAustria ? 'ja' : 'nein');
  row('Aufenthaltstitel', p.employment?.workPermitType, 'gültig bis', p.employment?.workPermitValidUntil ? fmtDate(p.employment.workPermitValidUntil) : null);
  row('Begünstigtenstatus (freiwillig)', p.employment?.disabilityStatus === 'ja' ? 'ja' : p.employment?.disabilityStatus === 'nein' ? 'nein' : 'keine Angabe', 'Bisherige Versicherung', p.employment?.previousInsurer);
  row('Weitere Beschäftigung', p.tax?.otherEmployment ? 'ja (Mehrfachversicherung prüfen)' : 'nein');

  section('5. Steuer / Familie (Angaben für Lohnsteuer)');
  row('AVAB/AEAB beantragt', p.tax?.avabRequested ? 'ja (Formular E 30 nachreichen)' : 'nein', 'Kinder', String(p.tax?.children?.length ?? 0));
  for (const c of p.tax?.children ?? []) row('  Kind', `${c.name || ''} ${c.birthDate ? fmtDate(c.birthDate) : ''}`.trim(), 'Familienbonus Plus', c.familienbonus ? 'ja (E 30)' : 'nein');
  row('Pendlerpauschale', p.tax?.commuteKm != null ? `${p.tax.commuteKm} km, Öffi zumutbar: ${p.tax.publicTransportReasonable ?? 'unbekannt'}, Pendlerrechner: ${p.tax.pendlerrechnerDone ? 'liegt vor' : 'offen'}` : 'keine Angabe');
  if (p.tax?.notes) row('Anmerkung', p.tax.notes);

  section('6. Dokumente (digital hinterlegt in Fairhours)');
  if (files.length === 0) row('–', 'keine Dokumente hochgeladen');
  for (const f of files) row(DOC_LABELS[f.kind].split(' (')[0], `${f.filename} · ${Math.round(f.size_bytes / 1024)} KB · SHA-256 ${f.sha256.slice(0, 12)}…`);

  section('7. Prüfung und Bestätigungen');
  const issues = profile.validation || [];
  if (issues.length === 0) row('Automatische Prüfung', 'keine Auffälligkeiten');
  for (const i of issues.slice(0, 12)) {
    page.drawText(safe(`${i.severity === 'error' ? '!' : i.severity === 'warn' ? '*' : 'i'} ${i.message}`), { x: M, y, size: 7.5, font, color: i.severity === 'error' ? rgb(0.7, 0.1, 0.1) : rgb(0.3, 0.3, 0.3), maxWidth: 500 });
    y -= 10;
  }
  const c = profile.consents as Record<string, unknown>;
  row('Bestätigungen', c?.at ? `Datenschutzinfo gelesen, Zustimmung Zeiterfassung (§ 10 AVRAG), Richtigkeit bestätigt – ${fmtDateTime(String(c.at), org.time_zone)}${c.ip ? ' · IP ' + c.ip : ''}` : 'noch nicht bestätigt');
  footer(1);

  // page 2 – ÖGK Mindestangaben
  page = doc.addPage(A4);
  header('ÖGK-Anmeldung – Mindestangaben');
  const m = oegkMinimalRegistration(p, { legalName: org.legal_name || org.name, dienstgeberkonto: (org.settings as { dienstgeberkonto?: string }).dienstgeberkonto ?? null });
  page.drawText('Anmeldung zur Sozialversicherung – Mindestangaben (§ 33 Abs 1a ASVG)', { x: M, y, size: 14, font: bold });
  y -= 18;
  page.drawText(safe('Vorlage für die Lohnverrechnung zur Übermittlung per ELDA. Die Mindestangaben-Anmeldung muss VOR Arbeitsantritt erfolgen, die vollständige Anmeldung binnen 7 Tagen.'), { x: M, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35), maxWidth: 500 });
  y -= 24;
  section('Dienstgeber');
  row('Dienstgeber', m.dienstgeber, 'Beitragskontonummer', m.beitragskontonummer);
  row('Adresse', org.address, 'UID', org.uid_number);
  section('Dienstnehmer:in');
  row('Nachname', m.nachname, 'Vorname', m.vorname);
  row('SV-Nummer', m.svNummer, 'Geburtsdatum', m.geburtsdatum ? fmtDate(m.geburtsdatum) : null);
  row('Beschäftigungsbeginn', m.beschaeftigungsbeginn ? fmtDate(m.beschaeftigungsbeginn) : null, 'Beschäftigungsort', m.beschaeftigungsort);
  row('Beschäftigtengruppe', m.beschaeftigtengruppe, 'Versicherung', m.vollversicherung);
  row('Wochenstunden', p.employment?.weeklyHours != null ? String(p.employment.weeklyHours).replace('.', ',') : null, 'Tätigkeit', p.employment?.jobTitle);
  y -= 6;
  page.drawText(safe(m.hinweis), { x: M, y, size: 8, font, color: rgb(0.3, 0.3, 0.3), maxWidth: 500 });
  y -= 40;
  section('Checkliste Lohnverrechnung');
  for (const t of ['Mindestangaben-Anmeldung per ELDA vor Arbeitsantritt', 'Vollständige Anmeldung binnen 7 Tagen (Entgelt, Beitragsgruppe, KV-Einstufung)', 'Dienstzettel/Dienstvertrag ausgehändigt (§ 2 AVRAG)', 'Formular E 30 (AVAB/Familienbonus) und L 34 EDV (Pendlerpauschale) falls zutreffend', 'Bei Drittstaatsangehörigen: Aufenthaltstitel/Beschäftigungsbewilligung geprüft und kopiert', 'Lohnkonto angelegt (§ 76 EStG), Aufbewahrung 7 Jahre']) {
    page.drawRectangle({ x: M, y: y - 1, width: 9, height: 9, borderWidth: 0.8, borderColor: rgb(0.3, 0.3, 0.3) });
    page.drawText(safe(t), { x: M + 14, y, size: 8.5, font });
    y -= 14;
  }
  footer(2);
  return doc.save();
}
