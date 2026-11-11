import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import type { DocKind } from '@/domain/onboarding';

/**
 * Optional AI helpers – active only when ANTHROPIC_API_KEY is configured.
 *  - Dokument-Extraktion (Ausweis, e-card, Meldezettel, Bankkarte, Aufenthaltstitel) → Vorschläge für den Fragebogen
 *  - Monats-Prüfbericht (Arbeitsrecht) als Klartext
 * Alle Ergebnisse sind Vorschläge; verbindlich wird nur, was Mitarbeiter:in/Admin bestätigt.
 */
export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 2 });
}

export const extractedSchema = z.object({
  documentType: z.string().describe('Erkannter Dokumenttyp, z. B. Reisepass, Personalausweis, Führerschein, e-card, Meldezettel, Aufenthaltstitel, Bankkarte, Sonstiges'),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  birthDate: z.string().nullable().describe('JJJJ-MM-TT'),
  birthPlace: z.string().nullable(),
  nationality: z.string().nullable().describe('deutsch, z. B. Österreich'),
  gender: z.enum(['w', 'm', 'd']).nullable(),
  svNumber: z.string().nullable().describe('10 Ziffern ohne Leerzeichen'),
  street: z.string().nullable(),
  zip: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  iban: z.string().nullable().describe('ohne Leerzeichen'),
  bic: z.string().nullable(),
  bankName: z.string().nullable(),
  documentNumber: z.string().nullable(),
  validUntil: z.string().nullable().describe('JJJJ-MM-TT'),
  residenceTitleType: z.string().nullable().describe('z. B. Rot-Weiß-Rot – Karte plus, Daueraufenthalt – EU, Aufenthaltsbewilligung'),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().nullable().describe('Unklarheiten, schlecht lesbare Stellen'),
});
export type Extracted = z.infer<typeof extractedSchema>;

const SUPPORTED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export async function extractDocument(kind: DocKind, mime: string, content: Uint8Array): Promise<Extracted | null> {
  if (!aiEnabled()) return null;
  const data = Buffer.from(content).toString('base64');
  const block: Anthropic.ContentBlockParam =
    mime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : { type: 'image', source: { type: 'base64', media_type: (SUPPORTED_IMAGE as readonly string[]).includes(mime) ? (mime as (typeof SUPPORTED_IMAGE)[number]) : 'image/jpeg', data } };
  const hint: Record<DocKind, string> = {
    id_card: 'Lichtbildausweis (Reisepass/Personalausweis/Führerschein): Name, Geburtsdatum, Geburtsort, Staatsbürgerschaft, Geschlecht, Dokumentnummer, gültig bis.',
    ecard: 'e-card oder SV-Nachweis: Name, Sozialversicherungsnummer (10 Ziffern: 4 Ziffern + Geburtsdatum TTMMJJ).',
    meldezettel: 'Meldezettel/Meldebestätigung: Name, Geburtsdatum, Hauptwohnsitz (Straße, PLZ, Ort), Staatsangehörigkeit.',
    residence_permit: 'Aufenthaltstitel/Beschäftigungsbewilligung: Titelart, Name, Geburtsdatum, gültig bis, Dokumentnummer.',
    bank_proof: 'Bankkarte/Kontonachweis: IBAN, BIC, Bankname, Kontoinhaber.',
    qualification: 'Zeugnis/Qualifikationsnachweis: Name, Abschluss/Ausbildung (in notes).',
    other: 'Sonstiges Dokument: alle personenbezogenen Stammdaten, die erkennbar sind.',
  };
  const res = await client().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system:
      'Du extrahierst Stammdaten aus Dokumenten für einen österreichischen Personalfragebogen. Gib nur Werte zurück, die im Dokument klar lesbar sind; sonst null. Datumsangaben als JJJJ-MM-TT. SV-Nummer: 10 Ziffern ohne Leerzeichen. Keine Vermutungen, keine Ergänzungen aus Allgemeinwissen. Wenn das Bild kein Dokument zeigt oder unlesbar ist, setze confidence auf low und beschreibe das in notes.',
    messages: [{ role: 'user', content: [block, { type: 'text', text: `Dokumentart laut Upload: ${hint[kind]} Extrahiere die Felder.` }] }],
    output_config: { format: zodOutputFormat(extractedSchema) },
  });
  if (res.stop_reason === 'refusal') return null;
  return res.parsed_output ?? null;
}

/** Kurzer Prüfbericht (Arbeitsrecht) für Führungskraft/Lohnverrechnung – Klartext, Deutsch. */
export async function monthlyReviewNarrative(input: { employeeName: string; month: string; facts: Record<string, unknown>; violations: Array<{ code: string; severity: string; date: string; message: string; legalRef: string }> }): Promise<string | null> {
  if (!aiEnabled()) return null;
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1200,
    output_config: { effort: 'low' },
    system:
      'Du bist Assistent:in einer österreichischen Lohnverrechnung. Du bekommst Kennzahlen und automatisch erkannte Auffälligkeiten eines Arbeitsmonats und schreibst einen kurzen, sachlichen Prüfbericht auf Deutsch (max. 8 Sätze): Was ist unauffällig, was muss die Führungskraft klären (mit Paragraph), was ist für die Abrechnung relevant (Überstunden, Mehrarbeit, Zuschlagsindikationen, Abwesenheiten). Keine Rechtsberatung, keine Vermutungen über Gründe, keine Zahlen erfinden. Ende mit einem Satz „Empfehlung: …“.',
    messages: [{ role: 'user', content: `Mitarbeiter:in: ${input.employeeName}\nMonat: ${input.month}\nKennzahlen (Minuten): ${JSON.stringify(input.facts)}\nAuffälligkeiten: ${JSON.stringify(input.violations)}` }],
  });
  if (res.stop_reason === 'refusal') return null;
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim() || null;
}
