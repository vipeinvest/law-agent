/** Client-safe formatting helpers (German, Austria). */
import { formatMinutes } from '@/domain/time';

export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function fmtDate(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const base = `${d}.${m}.${opts.year === false ? '' : y}`.replace(/\.$/, '.');
  return opts.weekday ? `${WEEKDAYS_SHORT[(wd + 6) % 7]}, ${base}` : base;
}

export function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_LONG[(wd + 6) % 7]}, ${d}. ${MONTHS[m - 1]} ${y}`;
}

export function fmtMonth(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function fmtTime(iso: string | null | undefined, timeZone = 'Europe/Vienna'): string {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined, timeZone = 'Europe/Vienna'): string {
  if (!iso) return '–';
  return new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso));
}

export function fmtH(min: number, sign = false): string {
  return formatMinutes(min, { sign }) + ' h';
}

export const ABSENCE_LABELS: Record<string, string> = {
  vacation: 'Urlaub',
  sick: 'Krankenstand',
  time_comp: 'Zeitausgleich',
  special_leave: 'Sonderurlaub',
  care_leave: 'Pflegefreistellung',
  training: 'Fortbildung',
  unpaid: 'Unbezahlt',
  other: 'Sonstiges',
};
export const LOCATION_LABELS: Record<string, string> = { office: 'Büro', remote: 'Telearbeit', field: 'Außendienst' };
export const TYPE_LABELS: Record<string, string> = { work: 'Arbeit', travel: 'Reisezeit', oncall: 'Rufbereitschaft' };
export const ROLE_LABELS: Record<string, string> = { owner: 'Inhaber:in', admin: 'Admin', manager: 'Vorgesetzte:r', payroll: 'Lohnverrechnung', employee: 'Mitarbeiter:in' };
export const PERIOD_LABELS: Record<string, string> = { open: 'Offen', submitted: 'Eingereicht', approved: 'Freigegeben', exported: 'Exportiert', reopened: 'Wieder geöffnet' };
