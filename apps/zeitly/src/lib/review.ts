import 'server-only';
import { formatMinutes } from '@/domain/time';
import { fmtMonth } from '@/lib/format';
import type { PeriodSummary } from '@/domain/types';

/** Deterministic monthly review text (always available; AI narrative is optional on top). */
export function deterministicReview(name: string, s: PeriodSummary): string {
  const lines: string[] = [];
  lines.push(`${name}, ${fmtMonth(s.year, s.month)}: Soll ${formatMinutes(s.targetMinutes)} h, Ist ${formatMinutes(s.workedMinutes)} h (davon Reisezeit ${formatMinutes(s.travelMinutes)} h), Gutschriften ${formatMinutes(s.creditMinutes)} h, Saldo ${formatMinutes(s.balanceStartMinutes, { sign: true })} → ${formatMinutes(s.balanceEndMinutes, { sign: true })} h.`);
  if (s.overtimeMinutes || s.mehrarbeitMinutes) lines.push(`Abrechnungsrelevant: Überstunden ${formatMinutes(s.overtimeMinutes)} h (davon 100 %-Indikation ${formatMinutes(s.overtime100Minutes)} h), Mehrarbeit ${formatMinutes(s.mehrarbeitMinutes)} h; Nacht ${formatMinutes(s.nightMinutes)} h, Sonntag ${formatMinutes(s.sundayMinutes)} h, Feiertagsarbeit ${formatMinutes(s.holidayMinutes)} h.`);
  const abs = Object.entries(s.absenceDays).filter(([, n]) => n > 0);
  if (abs.length || s.holidayDays) lines.push(`Abwesenheiten: ${abs.map(([k, n]) => `${k} ${n} T`).join(', ') || 'keine'}; Feiertage ${s.holidayDays} T; reine Telearbeitstage ${s.remoteOnlyDays}.`);
  const errors = s.violations.filter((v) => v.severity === 'error');
  const warns = s.violations.filter((v) => v.severity === 'warn');
  if (errors.length === 0 && warns.length === 0) lines.push('Prüfung: keine Verstöße gegen AZG/ARG-Grenzen erkannt.');
  if (errors.length) lines.push(`Zu klären (${errors.length}): ` + errors.slice(0, 6).map((v) => `${v.date.slice(8)}.${v.date.slice(5, 7)}. ${v.message} [${v.legalRef}]`).join(' · ') + (errors.length > 6 ? ' …' : ''));
  if (warns.length) lines.push(`Hinweise (${warns.length}): ` + warns.slice(0, 4).map((v) => `${v.date.slice(8)}.${v.date.slice(5, 7)}. ${v.message}`).join(' · ') + (warns.length > 4 ? ' …' : ''));
  lines.push(errors.length ? 'Empfehlung: Verstöße mit der Person klären und ggf. korrigieren, bevor der Monat freigegeben wird; wiederholte Überschreitungen sind organisatorisch abzustellen (AZG § 28 Strafbestimmungen).' : 'Empfehlung: Monat kann freigegeben werden; Zuschlagshöhen laut Kollektivvertrag in der Lohnverrechnung prüfen.');
  return lines.join('\n');
}
