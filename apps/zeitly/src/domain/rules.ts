/**
 * AZG/ARG rules engine – pure, deterministic, unit-tested.
 *
 * Rechtsgrundlagen (Österreich, Stand nach bestem Wissen; Grenzwerte sind in OrgRules konfigurierbar):
 *  - AZG § 3  Normalarbeitszeit 8 h / 40 h (KV oft 38,5 h)
 *  - AZG § 4b Gleitzeit: Normalarbeitszeit bis 10 h (12 h unter Voraussetzungen)
 *  - AZG § 9  Höchstgrenzen 12 h / 60 h, Ø 48 h in 17 Wochen
 *  - AZG § 10 Überstundenzuschlag 50 % (KV: höhere Zuschläge Nacht/Sonn-/Feiertag)
 *  - AZG § 11 Ruhepause 30 min bei > 6 h
 *  - AZG § 12 tägliche Ruhezeit 11 h
 *  - AZG § 19d Teilzeit: Mehrarbeit (25 % Zuschlag, Ausnahmen)
 *  - AZG § 20b Reisezeit
 *  - AZG § 26 Aufzeichnungspflicht (Abs 3: nur Dauer bei weitgehend selbstbestimmter Arbeitszeit/Telearbeit; Abs 5: Pausen bei fixer Vereinbarung)
 *  - ARG §§ 3, 4, 7 Wochenend-/Wochenruhe 36 h, Feiertagsruhe
 */
import type {
  Absence,
  AbsenceType,
  DayResult,
  Employment,
  EntryLocation,
  ISODate,
  ISOInstant,
  OrgRules,
  PeriodSummary,
  TimeEntry,
  Violation,
  WeekResult,
} from './types';
import { holidayMap, yearsInRange, type Holiday } from './holidays';
import {
  addDays,
  compareISODate,
  eachDay,
  formatMinutes,
  isoWeekKey,
  isoWeekday,
  localDateTimeToInstant,
  minutesBetween,
  monthRange,
  nightOverlapMinutes,
  roundMinutes,
  toISODate,
  weekStart,
} from './time';

export interface EvaluateInput {
  userId: string;
  year: number;
  month: number;
  rules: OrgRules;
  employment: Employment;
  /** Entries of the month plus surrounding days (≥ 7 days before, 1 after) for rest-period and week checks. */
  entries: TimeEntry[];
  absences: Absence[];
  balanceStartMinutes: number;
  customHolidays?: Holiday[];
  /** Reference instant for open-entry checks (default: now). */
  now?: ISOInstant;
  /** Optional worked minutes of earlier ISO weeks (for 17-week average). */
  historyWeeks?: Array<{ isoWeek: string; workedMinutes: number }>;
  /** Include not-yet-approved absences in the calculation (default false). */
  includeRequestedAbsences?: boolean;
  /** Veröffentlichte Dienstplan-Minuten je Datum; bei employment.targetMode 'plan' wird daraus das Tagessoll. */
  plannedMinutes?: Record<ISODate, number>;
}

const ABSENCE_TYPES: AbsenceType[] = ['vacation', 'sick', 'time_comp', 'special_leave', 'care_leave', 'training', 'unpaid', 'other'];

/** Net minutes of a single entry according to record mode (rounding applied). */
export function entryNetMinutes(e: TimeEntry, rules: OrgRules): number {
  let gross: number;
  if (e.startAt && e.endAt) {
    gross = Math.max(0, minutesBetween(e.startAt, e.endAt) - Math.max(0, e.breakMinutes || 0));
  } else if (e.durationMinutes != null) {
    gross = Math.max(0, e.durationMinutes);
  } else {
    return 0;
  }
  return roundMinutes(gross, rules.roundingMinutes);
}

export function dailyTargetMinutes(emp: Employment, weekday: number): number {
  if (!emp.workDays.includes(weekday)) return 0;
  const pattern = emp.dailyPattern?.[weekday];
  if (pattern != null) return pattern;
  return Math.round(emp.weeklyMinutes / Math.max(1, emp.workDays.length));
}

function isEmployed(emp: Employment, date: ISODate): boolean {
  if (emp.startDate && compareISODate(date, emp.startDate) < 0) return false;
  if (emp.endDate && compareISODate(date, emp.endDate) > 0) return false;
  return true;
}

interface AbsenceOnDay {
  type: AbsenceType;
  portion: number;
  id: string;
}

function expandAbsences(absences: Absence[], includeRequested: boolean): Map<ISODate, AbsenceOnDay> {
  const map = new Map<ISODate, AbsenceOnDay>();
  for (const a of absences) {
    if (a.status === 'rejected') continue;
    if (a.status === 'requested' && !includeRequested) continue;
    for (const d of eachDay(a.dateFrom, a.dateTo)) {
      const portion = a.dateFrom === a.dateTo ? a.portion : 1;
      map.set(d, { type: a.type, portion, id: a.id });
    }
  }
  return map;
}

function v(code: Violation['code'], severity: Violation['severity'], date: ISODate, message: string, legalRef: string, extra: Partial<Violation> = {}): Violation {
  return { code, severity, date, message, legalRef, ...extra };
}

/** Evaluate one calendar month for one employee. */
export function evaluatePeriod(input: EvaluateInput): PeriodSummary {
  const { rules, employment: emp, userId, year, month } = input;
  const tz = rules.timeZone || 'Europe/Vienna';
  const now = input.now ?? new Date().toISOString();
  const today = toISODate(now, tz);
  const { from, to } = monthRange(year, month);
  const holidays = holidayMap(yearsInRange(addDays(from, -14), addDays(to, 14)), rules.extraHolidays, input.customHolidays);
  const absenceByDay = expandAbsences(input.absences, !!input.includeRequestedAbsences);

  // group entries by work date
  const byDate = new Map<ISODate, TimeEntry[]>();
  for (const e of input.entries) {
    if (e.userId !== userId) continue;
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  for (const list of byDate.values()) list.sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''));

  const dailyOvertimeThreshold = emp.gleitzeit ? Math.max(rules.overtimeThresholdDailyMinutes, 600) : rules.overtimeThresholdDailyMinutes;
  const partTime = emp.weeklyMinutes < rules.fullTimeWeeklyMinutes;

  // ---- per-day evaluation (we evaluate a wider window for rest/week checks, but report only the month)
  const windowFrom = addDays(weekStart(from), -7);
  const windowTo = addDays(to, 7 - isoWeekday(to)); // end of the ISO week containing `to`
  const dayResults = new Map<ISODate, DayResult>();

  for (const date of eachDay(windowFrom, windowTo)) {
    const weekday = isoWeekday(date);
    const hol = holidays.get(date);
    const employed = isEmployed(emp, date);
    const planned = input.plannedMinutes?.[date];
    const baseTarget = !employed ? 0 : emp.targetMode === 'plan' ? (planned ?? 0) : dailyTargetMinutes(emp, weekday);
    const absence = absenceByDay.get(date);
    const entries = byDate.get(date) ?? [];
    const violations: Violation[] = [];

    let worked = 0;
    let travel = 0;
    let oncall = 0;
    let breaks = 0;
    let night = 0;
    let firstStart: ISOInstant | null = null;
    let lastEnd: ISOInstant | null = null;
    const locations: Partial<Record<EntryLocation, number>> = {};
    const projects: Record<string, number> = {};
    let hasFullEntries = false;

    for (const e of entries) {
      const net = entryNetMinutes(e, rules);
      if (e.startAt && !e.endAt) {
        if (compareISODate(e.date, today) < 0) {
          violations.push(v('ENTRY_OPEN', 'warn', date, 'Buchung ohne Ende – bitte Ende nachtragen.', 'AZG § 26 Abs 1', { entryIds: [e.id] }));
        }
        continue;
      }
      if (emp.recordMode === 'duration_only' && !e.startAt && e.durationMinutes == null) {
        violations.push(v('DURATION_ONLY_WITHOUT_DURATION', 'warn', date, 'Buchung ohne Dauer.', 'AZG § 26 Abs 3', { entryIds: [e.id] }));
        continue;
      }
      if (e.startAt && e.endAt) {
        hasFullEntries = true;
        if (!firstStart || e.startAt < firstStart) firstStart = e.startAt;
        if (!lastEnd || e.endAt > lastEnd) lastEnd = e.endAt;
        if (e.type !== 'oncall') night += nightOverlapMinutes(e.startAt, e.endAt, rules.nightStart, rules.nightEnd, tz);
      }
      if (e.type === 'oncall') {
        oncall += net;
        continue;
      }
      breaks += Math.max(0, e.breakMinutes || 0);
      if (e.type === 'travel') {
        travel += net;
        if (!rules.travelCountsAsWork) continue;
      }
      worked += net;
      locations[e.location] = (locations[e.location] ?? 0) + net;
      const pk = e.projectId ?? 'none';
      projects[pk] = (projects[pk] ?? 0) + net;
    }

    // overlaps + gaps between consecutive timed entries (a gap on the same day is a break, AZG § 11)
    const timed = entries.filter((e) => e.startAt && e.endAt && e.type !== 'oncall').sort((a, b) => a.startAt!.localeCompare(b.startAt!));
    let gapBreaks = 0;
    for (let i = 1; i < timed.length; i++) {
      if (timed[i].startAt! < timed[i - 1].endAt!) {
        violations.push(v('ENTRY_OVERLAP', 'error', date, 'Zwei Buchungen überschneiden sich.', 'AZG § 26 Abs 1', { entryIds: [timed[i - 1].id, timed[i].id] }));
      } else {
        const gap = minutesBetween(timed[i - 1].endAt!, timed[i].startAt!);
        if (gap > 0 && gap <= 240) gapBreaks += gap;
      }
    }
    breaks += gapBreaks;

    // auto break deduction (transparent, only when configured and no break recorded)
    let autoBreak = 0;
    if (worked > rules.breakAfterMinutes && breaks < rules.minBreakMinutes && rules.autoBreakDeduction && rules.fixedBreakAgreement) {
      autoBreak = rules.minBreakMinutes - breaks;
      worked = Math.max(0, worked - autoBreak);
      breaks += autoBreak;
    }

    // absence handling
    let target = baseTarget;
    let credit = 0;
    let timeComp = 0;
    if (absence && baseTarget > 0) {
      const portion = absence.portion;
      switch (absence.type) {
        case 'time_comp':
          timeComp = Math.round(baseTarget * portion);
          break;
        case 'unpaid':
          target = Math.round(baseTarget * (1 - portion));
          break;
        default:
          credit = Math.round(baseTarget * portion);
      }
      if (worked > 0 && portion === 1 && absence.type !== 'time_comp') {
        violations.push(v('ENTRY_ON_ABSENCE_DAY', 'warn', date, 'Arbeitszeit an einem Abwesenheitstag gebucht.', 'Plausibilität'));
      }
    }
    // holiday credit (only on a work day, after absences so vacation on a holiday is not double counted)
    let holidayFactor = 0;
    if (hol && baseTarget > 0 && !absence) {
      holidayFactor = hol.factor;
      credit = Math.round(baseTarget * hol.factor);
    } else if (hol) {
      holidayFactor = hol.factor;
    }

    // daily checks
    if (worked > rules.maxDailyMinutes) {
      violations.push(v('DAILY_MAX_EXCEEDED', 'error', date, `Tagesarbeitszeit ${formatMinutes(worked)} h überschreitet die Höchstgrenze von ${formatMinutes(rules.maxDailyMinutes)} h.`, 'AZG § 9 Abs 1', { minutes: worked - rules.maxDailyMinutes }));
    } else if (worked > dailyOvertimeThreshold && worked > 600) {
      violations.push(v('NORMAL_DAILY_EXCEEDED', 'warn', date, `Tagesarbeitszeit ${formatMinutes(worked)} h liegt über 10 h – nur mit Überstundenanordnung bzw. Gleitzeitregelung zulässig.`, 'AZG §§ 3, 4b, 7', { minutes: worked - dailyOvertimeThreshold }));
    }
    if (worked > rules.breakAfterMinutes && breaks < rules.minBreakMinutes && !rules.fixedBreakAgreement && hasFullEntries) {
      violations.push(v('BREAK_MISSING', 'error', date, `Bei mehr als ${formatMinutes(rules.breakAfterMinutes)} h Arbeitszeit ist eine Ruhepause von mindestens ${rules.minBreakMinutes} Minuten zu halten (erfasst: ${breaks} min).`, 'AZG § 11 Abs 1', { minutes: rules.minBreakMinutes - breaks }));
    }
    if (night > 0) {
      violations.push(v('NIGHT_WORK', 'info', date, `${formatMinutes(night)} h Nachtarbeit (${rules.nightStart}–${rules.nightEnd}).`, 'AZG § 12a / KV', { minutes: night }));
    }
    if (weekday === 7 && worked > 0) {
      violations.push(v('SUNDAY_WORK', 'info', date, `Sonntagsarbeit ${formatMinutes(worked)} h – nur mit Ausnahme nach ARG zulässig.`, 'ARG §§ 3, 10 ff', { minutes: worked }));
    }
    if (hol && hol.statutory && worked > 0) {
      violations.push(v('HOLIDAY_WORK', 'info', date, `Arbeit am Feiertag (${hol.name}) ${formatMinutes(worked)} h – Feiertagsentgelt/Zuschlag beachten.`, 'ARG §§ 7, 9', { minutes: worked }));
    }

    const overtime = Math.max(0, worked - dailyOvertimeThreshold);
    if (emp.azgExempt) {
      for (let i = violations.length - 1; i >= 0; i--) if (!['ENTRY_OVERLAP', 'ENTRY_OPEN', 'ENTRY_ON_ABSENCE_DAY', 'DURATION_ONLY_WITHOUT_DURATION'].includes(violations[i].code)) violations.splice(i, 1);
    }

    dayResults.set(date, {
      date,
      weekday,
      isHoliday: !!hol,
      holidayName: hol?.name,
      holidayFactor,
      isWorkDay: baseTarget > 0,
      targetMinutes: target,
      workedMinutes: worked,
      travelMinutes: travel,
      oncallMinutes: oncall,
      breakMinutes: breaks,
      autoBreakMinutes: autoBreak,
      nightMinutes: night,
      creditMinutes: credit,
      timeCompMinutes: timeComp,
      absenceType: absence?.type,
      absencePortion: absence?.portion,
      overtimeMinutes: overtime,
      firstStart,
      lastEnd,
      locations,
      projects,
      entries,
      violations,
    });
  }

  // ---- rest period between consecutive working days (11 h)
  const ordered = Array.from(dayResults.values()).sort((a, b) => compareISODate(a.date, b.date));
  let prevEnd: ISOInstant | null = null;
  let prevDate: ISODate | null = null;
  for (const d of ordered) {
    if (d.firstStart && prevEnd && prevDate && d.date !== prevDate) {
      const rest = minutesBetween(prevEnd, d.firstStart);
      if (rest >= 0 && rest < rules.minDailyRestMinutes && !emp.azgExempt) {
        d.violations.push(v('REST_TOO_SHORT', 'error', d.date, `Nur ${formatMinutes(rest)} h Ruhezeit seit dem Vortag (mindestens ${formatMinutes(rules.minDailyRestMinutes)} h).`, 'AZG § 12 Abs 1', { minutes: rules.minDailyRestMinutes - rest }));
      }
    }
    if (d.lastEnd) {
      prevEnd = d.lastEnd;
      prevDate = d.date;
    }
  }

  // ---- weeks
  const weeks = new Map<string, WeekResult & { days: DayResult[] }>();
  for (const d of ordered) {
    const key = isoWeekKey(d.date);
    const w = weeks.get(key) ?? { isoWeek: key, workedMinutes: 0, targetMinutes: 0, overtimeMinutes: 0, violations: [], days: [] };
    w.workedMinutes += d.workedMinutes;
    w.targetMinutes += d.targetMinutes;
    w.days.push(d);
    weeks.set(key, w);
  }
  const weeklyThreshold = rules.overtimeThresholdWeeklyMinutes;
  const mehrarbeitByWeek = new Map<string, number>();
  for (const w of weeks.values()) {
    const dailyOT = w.days.reduce((s, d) => s + d.overtimeMinutes, 0);
    w.overtimeMinutes = Math.max(0, w.workedMinutes - weeklyThreshold - dailyOT);
    const lastDay = w.days[w.days.length - 1].date;
    if (w.workedMinutes > rules.maxWeeklyMinutes && !emp.azgExempt) {
      w.violations.push(v('WEEKLY_MAX_EXCEEDED', 'error', lastDay, `Wochenarbeitszeit ${formatMinutes(w.workedMinutes)} h überschreitet ${formatMinutes(rules.maxWeeklyMinutes)} h.`, 'AZG § 9 Abs 1', { minutes: w.workedMinutes - rules.maxWeeklyMinutes }));
    }
    if (partTime) {
      const totalOT = dailyOT + w.overtimeMinutes;
      const nonOT = Math.max(0, w.workedMinutes - totalOT);
      const weeklyContract = w.days.reduce((s, d) => s + (d.isWorkDay ? d.targetMinutes + d.creditMinutes + d.timeCompMinutes : 0), 0) || emp.weeklyMinutes;
      const ma = Math.max(0, Math.min(nonOT, rules.fullTimeWeeklyMinutes) - weeklyContract);
      mehrarbeitByWeek.set(w.isoWeek, ma);
    }
    // weekend rest: longest work-free gap within Sat 00:00 .. Mon 24:00 touching Sunday
    const sunday = w.days.find((d) => d.weekday === 7);
    if (sunday) {
      const sat = addDays(sunday.date, -1);
      const monEnd = addDays(sunday.date, 2);
      const winStart = new Date(localDateTimeToInstant(sat, '00:00', tz)).getTime();
      const winEnd = new Date(localDateTimeToInstant(monEnd, '00:00', tz)).getTime();
      const intervals: Array<[number, number]> = [];
      for (const d of ordered) {
        for (const e of d.entries) {
          if (e.startAt && e.endAt && e.type !== 'oncall') {
            const s = new Date(e.startAt).getTime();
            const en = new Date(e.endAt).getTime();
            if (en > winStart && s < winEnd) intervals.push([Math.max(s, winStart), Math.min(en, winEnd)]);
          }
        }
      }
      intervals.sort((a, b) => a[0] - b[0]);
      let cursor = winStart;
      let maxGap = 0;
      for (const [s, e] of intervals) {
        if (s > cursor) maxGap = Math.max(maxGap, s - cursor);
        cursor = Math.max(cursor, e);
      }
      maxGap = Math.max(maxGap, winEnd - cursor);
      const anyWeekendWork = intervals.length > 0;
      if (anyWeekendWork && maxGap / 60000 < rules.weeklyRestMinutes && !emp.azgExempt) {
        w.violations.push(v('WEEKEND_REST_SHORT', 'warn', sunday.date, `Keine durchgehende Wochenendruhe von ${formatMinutes(rules.weeklyRestMinutes)} h (längste Pause ${formatMinutes(Math.round(maxGap / 60000))} h).`, 'ARG §§ 3, 4'));
      }
    }
  }

  // 17-week average (uses history if provided)
  const historyMap = new Map<string, number>(input.historyWeeks?.map((h) => [h.isoWeek, h.workedMinutes]) ?? []);
  for (const w of weeks.values()) historyMap.set(w.isoWeek, w.workedMinutes);
  const weekKeysSorted = Array.from(historyMap.keys()).sort();
  for (const w of weeks.values()) {
    const idx = weekKeysSorted.indexOf(w.isoWeek);
    const slice = weekKeysSorted.slice(Math.max(0, idx - 16), idx + 1);
    if (slice.length >= 4) {
      const avg = slice.reduce((s, k) => s + (historyMap.get(k) ?? 0), 0) / slice.length;
      if (avg > rules.avgWeeklyMinutes17w && !emp.azgExempt) {
        const lastDay = w.days[w.days.length - 1].date;
        w.violations.push(v('AVG_17W_EXCEEDED', 'warn', lastDay, `Durchschnittliche Wochenarbeitszeit ${formatMinutes(Math.round(avg))} h über ${slice.length} Wochen überschreitet ${formatMinutes(rules.avgWeeklyMinutes17w)} h.`, 'AZG § 9 Abs 4'));
      }
    }
  }

  // ---- aggregate month
  const days = ordered.filter((d) => compareISODate(d.date, from) >= 0 && compareISODate(d.date, to) <= 0);
  const monthWeeks = Array.from(weeks.values()).filter((w) => w.days.some((d) => compareISODate(d.date, from) >= 0 && compareISODate(d.date, to) <= 0));
  const sum = (f: (d: DayResult) => number) => days.reduce((s, d) => s + f(d), 0);
  const targetMinutes = sum((d) => d.targetMinutes);
  const workedMinutes = sum((d) => d.workedMinutes);
  const creditMinutes = sum((d) => d.creditMinutes);
  const timeCompMinutes = sum((d) => d.timeCompMinutes);
  const dailyOT = sum((d) => d.overtimeMinutes);
  // weekly overtime/Mehrarbeit attributed to the month in which the ISO week ends
  const weeklyOT = monthWeeks.filter((w) => compareISODate(w.days[w.days.length - 1].date, to) <= 0 && compareISODate(w.days[w.days.length - 1].date, from) >= 0).reduce((s, w) => s + w.overtimeMinutes, 0);
  const mehrarbeit = monthWeeks.filter((w) => compareISODate(w.days[w.days.length - 1].date, to) <= 0 && compareISODate(w.days[w.days.length - 1].date, from) >= 0).reduce((s, w) => s + (mehrarbeitByWeek.get(w.isoWeek) ?? 0), 0);
  const overtimeMinutes = dailyOT + weeklyOT;
  const nightMinutes = sum((d) => d.nightMinutes);
  const sundayMinutes = sum((d) => (d.weekday === 7 ? d.workedMinutes : 0));
  const holidayMinutes = sum((d) => (d.isHoliday && d.holidayFactor >= 1 ? d.workedMinutes : 0));
  const overtime100 = Math.min(overtimeMinutes, nightMinutes + sundayMinutes + holidayMinutes);

  const absenceDays = Object.fromEntries(ABSENCE_TYPES.map((t) => [t, 0])) as Record<AbsenceType, number>;
  let holidayDays = 0;
  let remoteOnlyDays = 0;
  let workedDays = 0;
  let oncallDays = 0;
  const byProject: Record<string, number> = {};
  const byLocation: Partial<Record<EntryLocation, number>> = {};
  for (const d of days) {
    if (d.absenceType && d.isWorkDay) absenceDays[d.absenceType] += d.absencePortion ?? 1;
    if (d.isHoliday && d.isWorkDay && !d.absenceType) holidayDays += d.holidayFactor;
    if (d.oncallMinutes > 0) oncallDays++;
    if (d.workedMinutes > 0) {
      workedDays++;
      const locs = Object.keys(d.locations);
      if (locs.length === 1 && locs[0] === 'remote') remoteOnlyDays++;
    }
    for (const [k, m] of Object.entries(d.projects)) byProject[k] = (byProject[k] ?? 0) + m;
    for (const [k, m] of Object.entries(d.locations)) byLocation[k as EntryLocation] = (byLocation[k as EntryLocation] ?? 0) + (m ?? 0);
  }

  const violations = [...days.flatMap((d) => d.violations), ...monthWeeks.flatMap((w) => w.violations.filter((x) => compareISODate(x.date, from) >= 0 && compareISODate(x.date, to) <= 0))].sort((a, b) => compareISODate(a.date, b.date));

  const balanceEndMinutes = input.balanceStartMinutes + workedMinutes + creditMinutes - targetMinutes;

  return {
    userId,
    year,
    month,
    from,
    to,
    days,
    weeks: monthWeeks.map(({ days: _d, ...w }) => w),
    targetMinutes,
    workedMinutes,
    travelMinutes: sum((d) => d.travelMinutes),
    oncallMinutes: sum((d) => d.oncallMinutes),
    creditMinutes,
    timeCompMinutes,
    balanceStartMinutes: input.balanceStartMinutes,
    balanceEndMinutes,
    overtimeMinutes,
    mehrarbeitMinutes: mehrarbeit,
    overtime100Minutes: overtime100,
    overtime50Minutes: Math.max(0, overtimeMinutes - overtime100),
    nightMinutes,
    sundayMinutes,
    holidayMinutes,
    absenceDays,
    holidayDays,
    remoteOnlyDays,
    workedDays,
    oncallDays,
    byProject,
    byLocation,
    violations,
    errorCount: violations.filter((x) => x.severity === 'error').length,
    warnCount: violations.filter((x) => x.severity === 'warn').length,
  };
}

/** Quick live check for the running day (used by the timer UI): returns advisory hints. */
export function liveHints(workedTodayMinutes: number, breakTodayMinutes: number, rules: OrgRules, gleitzeit: boolean): string[] {
  const hints: string[] = [];
  if (workedTodayMinutes > rules.breakAfterMinutes && breakTodayMinutes < rules.minBreakMinutes && !rules.fixedBreakAgreement) {
    hints.push(`Pause fällig: nach 6 Stunden sind mindestens ${rules.minBreakMinutes} Minuten Ruhepause vorgesehen (AZG § 11).`);
  }
  const threshold = gleitzeit ? Math.max(rules.overtimeThresholdDailyMinutes, 600) : rules.overtimeThresholdDailyMinutes;
  if (workedTodayMinutes > threshold) hints.push(`Du bist über der Normalarbeitszeit (${formatMinutes(threshold)} h) – ab jetzt zählen Überstunden.`);
  if (workedTodayMinutes > rules.maxDailyMinutes - 30 && workedTodayMinutes <= rules.maxDailyMinutes) hints.push('Achtung: in 30 Minuten ist die gesetzliche Höchstgrenze von 12 Stunden erreicht (AZG § 9).');
  if (workedTodayMinutes > rules.maxDailyMinutes) hints.push('Höchstgrenze von 12 Stunden überschritten – bitte Arbeit beenden und Vorgesetzte informieren (AZG § 9).');
  return hints;
}
