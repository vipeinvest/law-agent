/** Time helpers – everything is computed in the organisation's IANA time zone (default Europe/Vienna). */
import type { ISODate, ISOInstant } from './types';

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(instant: Date | ISOInstant, timeZone: string): ZonedParts {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const parts = dtf(timeZone).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(instant: Date | ISOInstant, timeZone: string): ISODate {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function toLocalTime(instant: Date | ISOInstant, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Offset (minutes) of timeZone at the given UTC instant. */
export function tzOffsetMinutes(utc: Date, timeZone: string): number {
  const p = zonedParts(utc, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - utc.getTime()) / 60000);
}

/** Build a UTC instant from local wall-clock values in timeZone (handles DST transitions). */
export function zonedToUTC(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // two-pass correction
  for (let i = 0; i < 2; i++) {
    const off = tzOffsetMinutes(new Date(guess), timeZone);
    guess = Date.UTC(year, month - 1, day, hour, minute, 0) - off * 60000;
  }
  return new Date(guess);
}

export function localDateTimeToInstant(date: ISODate, time: string, timeZone: string): ISOInstant {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return zonedToUTC(y, m, d, hh, mm, timeZone).toISOString();
}

export function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function isoDateFromYMD(year: number, month: number, day: number): ISODate {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Add days to an ISO date (calendar arithmetic, no time zone needed). */
export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return isoDateFromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function compareISODate(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** ISO weekday 1 (Mon) … 7 (Sun). */
export function isoWeekday(date: ISODate): number {
  const { year, month, day } = parseISODate(date);
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function isoWeekKey(date: ISODate): string {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(week)}`;
}

/** Monday of the ISO week containing date. */
export function weekStart(date: ISODate): ISODate {
  return addDays(date, 1 - isoWeekday(date));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthRange(year: number, month: number): { from: ISODate; to: ISODate } {
  return { from: isoDateFromYMD(year, month, 1), to: isoDateFromYMD(year, month, daysInMonth(year, month)) };
}

export function* eachDay(from: ISODate, to: ISODate): Generator<ISODate> {
  let d = from;
  while (compareISODate(d, to) <= 0) {
    yield d;
    d = addDays(d, 1);
  }
}

export function minutesBetween(a: ISOInstant, b: ISOInstant): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export function formatMinutes(min: number, opts: { sign?: boolean } = {}): string {
  const neg = min < 0;
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const s = `${h}:${pad2(m)}`;
  if (neg) return `-${s}`;
  return opts.sign && min > 0 ? `+${s}` : s;
}

export function formatDecimalHours(min: number, digits = 2): string {
  return (Math.round((min / 60) * 10 ** digits) / 10 ** digits).toFixed(digits).replace('.', ',');
}

export function roundMinutes(min: number, step: number, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
  if (!step || step <= 1) return Math.round(min);
  const q = min / step;
  const r = mode === 'down' ? Math.floor(q) : mode === 'up' ? Math.ceil(q) : Math.round(q);
  return r * step;
}

/** Overlap in minutes between [aStart,aEnd) and the daily window [winStart,winEnd) that may wrap midnight (e.g. 22:00–06:00). */
export function nightOverlapMinutes(startAt: ISOInstant, endAt: ISOInstant, nightStart: string, nightEnd: string, timeZone: string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (end <= start) return 0;
  const [nsH, nsM] = nightStart.split(':').map(Number);
  const [neH, neM] = nightEnd.split(':').map(Number);
  // iterate over the local days touched by the interval (max a few)
  let total = 0;
  const firstDay = toISODate(start, timeZone);
  for (let i = -1; i <= 2; i++) {
    const day = addDays(firstDay, i);
    const { year, month, day: dd } = parseISODate(day);
    const ws = zonedToUTC(year, month, dd, nsH, nsM, timeZone).getTime();
    let we = zonedToUTC(year, month, dd, neH, neM, timeZone).getTime();
    if (we <= ws) {
      const next = addDays(day, 1);
      const n = parseISODate(next);
      we = zonedToUTC(n.year, n.month, n.day, neH, neM, timeZone).getTime();
    }
    const s = Math.max(start.getTime(), ws);
    const e = Math.min(end.getTime(), we);
    if (e > s) total += (e - s) / 60000;
  }
  return Math.round(total);
}

export function nowISO(): ISOInstant {
  return new Date().toISOString();
}
