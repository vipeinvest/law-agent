/**
 * Onboarding / Personalfragebogen – Datenmodell, Pflichtfelder und deterministische Prüfungen
 * (SV-Nummer-Prüfziffer, IBAN, Alter/KJBG, Aufenthaltstitel, Vollständigkeit).
 * Pure functions, unit-tested. Keine Rechtsberatung – Felder orientieren sich am üblichen
 * Personalfragebogen österreichischer Lohnverrechnungen und an den Mindestangaben der ÖGK-Anmeldung.
 */
import { z } from 'zod';

export const DOC_KINDS = ['id_card', 'ecard', 'meldezettel', 'residence_permit', 'bank_proof', 'qualification', 'other'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LABELS: Record<DocKind, string> = {
  id_card: 'Lichtbildausweis (Reisepass / Personalausweis / Führerschein)',
  ecard: 'e-card oder Nachweis der SV-Nummer',
  meldezettel: 'Meldezettel / Meldebestätigung',
  residence_permit: 'Aufenthaltstitel / Beschäftigungsbewilligung',
  bank_proof: 'Bankkarte oder Kontonachweis (IBAN)',
  qualification: 'Zeugnisse / Qualifikationsnachweise',
  other: 'Sonstiges',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format JJJJ-MM-TT');
const opt = <T extends z.ZodTypeAny>(s: T) => s.optional().or(z.literal('').transform(() => undefined));

export const profileSchema = z.object({
  person: z
    .object({
      title: opt(z.string().max(40)),
      firstName: z.string().min(1, 'Vorname fehlt').max(80),
      lastName: z.string().min(1, 'Nachname fehlt').max(80),
      birthDate: isoDate,
      svNumber: z.string().regex(/^\d{10}$/, 'SV-Nummer: 10 Ziffern (z. B. 1234 010180)'),
      nationality: z.string().min(2, 'Staatsbürgerschaft fehlt').max(60),
      gender: opt(z.enum(['w', 'm', 'd', 'k'])),
      maritalStatus: opt(z.enum(['ledig', 'verheiratet', 'eingetragene_partnerschaft', 'geschieden', 'verwitwet', 'lebensgemeinschaft'])),
      birthPlace: opt(z.string().max(80)),
    })
    .partial({ title: true, gender: true, maritalStatus: true, birthPlace: true }),
  contact: z.object({
    street: z.string().min(1, 'Straße fehlt').max(120),
    zip: z.string().min(4, 'PLZ fehlt').max(10),
    city: z.string().min(1, 'Ort fehlt').max(80),
    country: z.string().min(2).max(60).default('Österreich'),
    phone: z.string().min(5, 'Telefonnummer fehlt').max(40),
    privateEmail: opt(z.string().email('Ungültige E-Mail')),
    emergencyName: opt(z.string().max(80)),
    emergencyPhone: opt(z.string().max(40)),
  }),
  bank: z.object({
    iban: z.string().min(15, 'IBAN fehlt').max(34),
    bic: opt(z.string().max(11)),
    accountHolder: opt(z.string().max(120)),
  }),
  tax: z.object({
    children: z.array(z.object({ name: opt(z.string().max(80)), birthDate: isoDate, familienbonus: z.boolean().default(false) })).default([]),
    avabRequested: z.boolean().default(false),
    commuteKm: opt(z.coerce.number().min(0).max(500)),
    publicTransportReasonable: opt(z.enum(['ja', 'nein', 'unbekannt'])),
    pendlerrechnerDone: z.boolean().default(false),
    otherEmployment: z.boolean().default(false),
    notes: opt(z.string().max(500)),
  }),
  employment: z.object({
    jobTitle: z.string().min(1, 'Tätigkeit/Berufsbezeichnung fehlt').max(120),
    startDate: isoDate,
    weeklyHours: z.coerce.number().min(1, 'Wochenstunden fehlen').max(60),
    education: opt(z.string().max(120)),
    previousServiceNote: opt(z.string().max(500)),
    workPermitType: opt(z.string().max(120)),
    workPermitValidUntil: opt(isoDate),
    disabilityStatus: opt(z.enum(['nein', 'ja', 'keine_angabe'])),
    previousInsurer: opt(z.string().max(120)),
    firstJobInAustria: z.boolean().default(false),
  }),
});
export type Profile = z.infer<typeof profileSchema>;
export type ProfileInput = z.input<typeof profileSchema>;

export const consentsSchema = z.object({
  privacyInfoRead: z.literal(true, { errorMap: () => ({ message: 'Bitte Datenschutzinformation bestätigen' }) }),
  timeTrackingConsent: z.literal(true, { errorMap: () => ({ message: 'Bitte Zustimmung zur Zeiterfassung bestätigen' }) }),
  dataCorrect: z.literal(true, { errorMap: () => ({ message: 'Bitte Richtigkeit bestätigen' }) }),
});

/** EU/EWR + Schweiz: keine Beschäftigungsbewilligung/Aufenthaltstitel nötig (Ausnahme: keine). */
export const EU_EEA_CH = [
  'österreich', 'austria', 'belgien', 'bulgarien', 'dänemark', 'deutschland', 'estland', 'finnland', 'frankreich', 'griechenland', 'irland', 'italien', 'kroatien', 'lettland', 'litauen', 'luxemburg', 'malta', 'niederlande', 'polen', 'portugal', 'rumänien', 'schweden', 'slowakei', 'slowenien', 'spanien', 'tschechien', 'ungarn', 'zypern',
  'island', 'liechtenstein', 'norwegen', 'schweiz',
];
export function needsWorkPermit(nationality: string | undefined): boolean {
  if (!nationality) return false;
  const n = nationality.trim().toLowerCase();
  return !EU_EEA_CH.some((c) => n.includes(c));
}

/** Österreichische SV-Nummer: 10 Ziffern, Prüfziffer an 4. Stelle (Gewichte 3,7,9,0,5,8,4,2,1,6; mod 11). */
export function validateSvNumber(sv: string): { ok: boolean; reason?: string; birthDate?: string } {
  const digits = sv.replace(/\s+/g, '');
  if (!/^\d{10}$/.test(digits)) return { ok: false, reason: '10 Ziffern erwartet' };
  const d = digits.split('').map(Number);
  const weights = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6];
  const sum = d.reduce((s, x, i) => s + x * weights[i], 0);
  const check = sum % 11;
  if (check === 10) return { ok: false, reason: 'Prüfsumme ungültig (Rest 10 – Nummer wird nicht vergeben)' };
  if (check !== d[3]) return { ok: false, reason: `Prüfziffer stimmt nicht (erwartet ${check})` };
  const dd = digits.slice(4, 6);
  const mm = digits.slice(6, 8);
  const yy = digits.slice(8, 10);
  // Hinweis: bei Ersatz-SV-Nummern kann der Datumsanteil vom Geburtsdatum abweichen (Tag + 32 etc.)
  const day = Number(dd);
  const month = Number(mm);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const year = Number(yy) <= Number(String(new Date().getFullYear()).slice(2)) ? 2000 + Number(yy) : 1900 + Number(yy);
    return { ok: true, birthDate: `${year}-${mm}-${dd}` };
  }
  return { ok: true };
}

/** IBAN: Format + Mod-97 (ISO 7064). */
export function validateIban(ibanRaw: string): { ok: boolean; reason?: string; iban?: string } {
  const iban = ibanRaw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return { ok: false, reason: 'IBAN-Format ungültig' };
  if (iban.startsWith('AT') && iban.length !== 20) return { ok: false, reason: 'Österreichische IBAN hat 20 Zeichen' };
  if (iban.startsWith('DE') && iban.length !== 22) return { ok: false, reason: 'Deutsche IBAN hat 22 Zeichen' };
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  if (rem !== 1) return { ok: false, reason: 'IBAN-Prüfsumme ungültig' };
  return { ok: true, iban };
}

export function ageAt(birthDate: string, at: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ay, am, ad] = at.split('-').map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age--;
  return age;
}

export interface ProfileIssue {
  field: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
}

/** Deterministische Plausibilitäts- und Rechtsprüfungen (ergänzend zum Schema). */
export function checkProfile(p: Partial<Profile>, docs: DocKind[] = []): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const person = p.person;
  if (person?.svNumber) {
    const sv = validateSvNumber(person.svNumber);
    if (!sv.ok) issues.push({ field: 'person.svNumber', severity: 'error', message: `SV-Nummer: ${sv.reason}` });
    else if (sv.birthDate && person.birthDate && sv.birthDate !== person.birthDate) issues.push({ field: 'person.svNumber', severity: 'warn', message: `Datum in der SV-Nummer (${sv.birthDate.split('-').reverse().join('.')}) weicht vom Geburtsdatum ab – bei Ersatznummern normal, bitte prüfen.` });
  }
  if (p.bank?.iban) {
    const ib = validateIban(p.bank.iban);
    if (!ib.ok) issues.push({ field: 'bank.iban', severity: 'error', message: `IBAN: ${ib.reason}` });
  }
  if (person?.birthDate && p.employment?.startDate) {
    const age = ageAt(person.birthDate, p.employment.startDate);
    if (age < 15) issues.push({ field: 'person.birthDate', severity: 'error', message: 'Unter 15 Jahren bei Eintritt – Beschäftigung grundsätzlich unzulässig (KJBG).' });
    else if (age < 18) issues.push({ field: 'person.birthDate', severity: 'warn', message: 'Jugendliche:r (unter 18): KJBG gilt – Fairhours bildet die Sonderregeln (Arbeitszeit, Nachtarbeit, Pausen) nicht ab, bitte Lohnverrechnung informieren.' });
    if (age > 70) issues.push({ field: 'person.birthDate', severity: 'info', message: 'Eintrittsalter über 70 – Geburtsdatum bitte prüfen.' });
  }
  if (needsWorkPermit(person?.nationality)) {
    if (!p.employment?.workPermitType) issues.push({ field: 'employment.workPermitType', severity: 'error', message: 'Drittstaatsangehörigkeit: Aufenthaltstitel mit Arbeitsmarktzugang bzw. Beschäftigungsbewilligung (AuslBG) erforderlich – Art und Gültigkeit angeben.' });
    if (!docs.includes('residence_permit')) issues.push({ field: 'docs.residence_permit', severity: 'error', message: 'Dokument „Aufenthaltstitel / Beschäftigungsbewilligung“ fehlt.' });
    if (p.employment?.workPermitValidUntil && p.employment.startDate && p.employment.workPermitValidUntil < p.employment.startDate) issues.push({ field: 'employment.workPermitValidUntil', severity: 'error', message: 'Aufenthaltstitel läuft vor Eintritt ab.' });
  }
  if (p.employment?.startDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (p.employment.startDate < today) issues.push({ field: 'employment.startDate', severity: 'warn', message: 'Eintritt liegt in der Vergangenheit – ÖGK-Anmeldung muss VOR Arbeitsantritt erfolgen (§ 33 ASVG); nachträgliche Meldung mit Lohnverrechnung klären.' });
  }
  if (p.employment?.weeklyHours && p.employment.weeklyHours > 40) issues.push({ field: 'employment.weeklyHours', severity: 'warn', message: 'Mehr als 40 Wochenstunden vertraglich – nur mit Überstundenvereinbarung zulässig (AZG § 3, § 7).' });
  if (p.tax?.children?.some((c) => c.birthDate && ageAt(c.birthDate, new Date().toISOString().slice(0, 10)) >= 18 && c.familienbonus)) issues.push({ field: 'tax.children', severity: 'info', message: 'Familienbonus Plus für Kinder ab 18 nur bei Familienbeihilfebezug (verminderter Betrag).' });
  if (p.tax?.commuteKm != null && p.tax.commuteKm >= 20 && !p.tax.pendlerrechnerDone) issues.push({ field: 'tax.commuteKm', severity: 'info', message: 'Pendlerpauschale möglich: Ausdruck des Pendlerrechners (BMF) dem Arbeitgeber vorlegen (Formular L 34 EDV).' });
  if (p.contact?.zip && p.contact.country?.toLowerCase().startsWith('öster') && !/^\d{4}$/.test(p.contact.zip)) issues.push({ field: 'contact.zip', severity: 'warn', message: 'Österreichische PLZ hat 4 Ziffern.' });
  for (const k of ['id_card', 'ecard', 'meldezettel'] as DocKind[]) if (!docs.includes(k)) issues.push({ field: `docs.${k}`, severity: 'warn', message: `Dokument „${DOC_LABELS[k]}“ noch nicht hochgeladen.` });
  if (!docs.includes('bank_proof')) issues.push({ field: 'docs.bank_proof', severity: 'info', message: 'Kontonachweis empfohlen (Zahlendreher in der IBAN vermeiden).' });
  return issues;
}

/** Anteil ausgefüllter Pflichtfelder in Prozent. */
export function completeness(p: Partial<ProfileInput>): number {
  const required: Array<[string, unknown]> = [
    ['person.firstName', p.person?.firstName],
    ['person.lastName', p.person?.lastName],
    ['person.birthDate', p.person?.birthDate],
    ['person.svNumber', p.person?.svNumber],
    ['person.nationality', p.person?.nationality],
    ['contact.street', p.contact?.street],
    ['contact.zip', p.contact?.zip],
    ['contact.city', p.contact?.city],
    ['contact.phone', p.contact?.phone],
    ['bank.iban', p.bank?.iban],
    ['employment.jobTitle', p.employment?.jobTitle],
    ['employment.startDate', p.employment?.startDate],
    ['employment.weeklyHours', p.employment?.weeklyHours],
  ];
  const filled = required.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').length;
  return Math.round((filled / required.length) * 100);
}

/** Mindestangaben-Anmeldung ÖGK (§ 33 Abs 1a ASVG) – Daten, die die Lohnverrechnung vor Arbeitsantritt per ELDA meldet. */
export function oegkMinimalRegistration(p: Partial<Profile>, org: { legalName: string; dienstgeberkonto?: string | null }) {
  return {
    dienstgeber: org.legalName,
    beitragskontonummer: org.dienstgeberkonto || '[Beitragskontonummer ÖGK eintragen]',
    nachname: p.person?.lastName ?? '',
    vorname: p.person?.firstName ?? '',
    svNummer: p.person?.svNumber ?? '',
    geburtsdatum: p.person?.birthDate ?? '',
    beschaeftigungsbeginn: p.employment?.startDate ?? '',
    beschaeftigungsort: '[Beschäftigungsort]',
    beschaeftigtengruppe: Number(p.employment?.weeklyHours ?? 0) > 0 ? 'Angestellte:r / Arbeiter:in laut Dienstvertrag' : '',
    vollversicherung: 'ja (Geringfügigkeitsgrenze prüfen)',
    hinweis: 'Die Mindestangaben-Anmeldung muss vor Arbeitsantritt erfolgen; die vollständige Anmeldung binnen 7 Tagen (§ 33 ASVG). Übermittlung per ELDA durch die Lohnverrechnung.',
  };
}
