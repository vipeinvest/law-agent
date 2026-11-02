/**
 * Gesetzliche Feiertage Österreich (ARG § 7 Abs 2) + betriebliche Zusatztage.
 * Karfreitag ist seit 2019 kein gesetzlicher Feiertag mehr (persönlicher Feiertag nach UrlG § 7a).
 */
import type { ISODate } from './types';
import { addDays, isoDateFromYMD, parseISODate } from './time';

export interface Holiday {
  date: ISODate;
  name: string;
  /** 1 = ganztägig frei, 0.5 = halber Tag (nur betriebliche Zusatztage, z. B. 24.12./31.12. laut KV). */
  factor: number;
  statutory: boolean;
}

/** Gauss/Meeus Easter Sunday (Gregorian). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDateFromYMD(year, month, day);
}

export function statutoryHolidaysAT(year: number): Holiday[] {
  const easter = easterSunday(year);
  const fixed: Array<[string, string]> = [
    ['01-01', 'Neujahr'],
    ['01-06', 'Heilige Drei Könige'],
    ['05-01', 'Staatsfeiertag'],
    ['08-15', 'Mariä Himmelfahrt'],
    ['10-26', 'Nationalfeiertag'],
    ['11-01', 'Allerheiligen'],
    ['12-08', 'Mariä Empfängnis'],
    ['12-25', 'Christtag'],
    ['12-26', 'Stefanitag'],
  ];
  const list: Holiday[] = fixed.map(([md, name]) => ({ date: `${year}-${md}`, name, factor: 1, statutory: true }));
  list.push({ date: addDays(easter, 1), name: 'Ostermontag', factor: 1, statutory: true });
  list.push({ date: addDays(easter, 39), name: 'Christi Himmelfahrt', factor: 1, statutory: true });
  list.push({ date: addDays(easter, 50), name: 'Pfingstmontag', factor: 1, statutory: true });
  list.push({ date: addDays(easter, 60), name: 'Fronleichnam', factor: 1, statutory: true });
  return list.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function holidayMap(years: number[], extra: Record<string, number> = {}, custom: Holiday[] = []): Map<ISODate, Holiday> {
  const map = new Map<ISODate, Holiday>();
  for (const y of years) {
    for (const h of statutoryHolidaysAT(y)) map.set(h.date, h);
    for (const [md, factor] of Object.entries(extra)) {
      const date = `${y}-${md}`;
      if (!map.has(date) && factor > 0) {
        const name = md === '12-24' ? 'Heiliger Abend' : md === '12-31' ? 'Silvester' : 'Betrieblicher Feiertag';
        map.set(date, { date, name, factor: Math.min(1, factor), statutory: false });
      }
    }
  }
  for (const c of custom) map.set(c.date, c);
  return map;
}

export function yearsInRange(from: ISODate, to: ISODate): number[] {
  const a = parseISODate(from).year;
  const b = parseISODate(to).year;
  const out: number[] = [];
  for (let y = a; y <= b; y++) out.push(y);
  return out;
}
