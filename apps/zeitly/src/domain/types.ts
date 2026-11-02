/**
 * Zeitly domain types – shared between rules engine, DB layer and UI.
 * All durations are integer minutes. Dates are ISO calendar dates (YYYY-MM-DD) in the
 * organisation's time zone (Europe/Vienna); instants are ISO-8601 strings in UTC.
 */

export type Minutes = number;
export type ISODate = string; // YYYY-MM-DD
export type ISOInstant = string; // 2026-11-02T07:00:00.000Z

export type Role = 'owner' | 'admin' | 'manager' | 'payroll' | 'employee';

export type EntryType = 'work' | 'travel' | 'oncall';
export type EntryLocation = 'office' | 'remote' | 'field';
export type EntrySource = 'timer' | 'manual' | 'import' | 'correction' | 'plan';
export type EntryStatus = 'open' | 'submitted' | 'approved' | 'locked';

export type AbsenceType =
  | 'vacation' // Urlaub (UrlG)
  | 'sick' // Krankenstand (EFZG/AngG)
  | 'time_comp' // Zeitausgleich
  | 'special_leave' // Sonderurlaub / Dienstverhinderung (§ 8 Abs 3 AngG, § 1154b ABGB)
  | 'care_leave' // Pflegefreistellung (§ 16 UrlG)
  | 'training' // Fortbildung (bezahlt)
  | 'unpaid' // unbezahlter Urlaub / Karenz
  | 'other';

export type RecordMode = 'full' | 'duration_only'; // § 26 Abs 3 AZG

export interface OrgRules {
  /** Normalarbeitszeit pro Tag in Minuten (AZG § 3: 480). */
  normalDailyMinutes: number;
  /** Normalarbeitszeit pro Woche in Minuten (AZG § 3: 2400; viele KV 2310 = 38,5 h). */
  normalWeeklyMinutes: number;
  /** Höchstgrenze Tagesarbeitszeit (AZG § 9: 720). */
  maxDailyMinutes: number;
  /** Höchstgrenze Wochenarbeitszeit (AZG § 9: 3600). */
  maxWeeklyMinutes: number;
  /** Durchschnittliche Wochenarbeitszeit im 17-Wochen-Zeitraum (AZG § 9: 2880 = 48 h). */
  avgWeeklyMinutes17w: number;
  /** Ab welcher Tagesarbeitszeit eine Ruhepause nötig ist (AZG § 11: > 360). */
  breakAfterMinutes: number;
  /** Mindestdauer Ruhepause (AZG § 11: 30). */
  minBreakMinutes: number;
  /** Tägliche Ruhezeit (AZG § 12: 660 = 11 h). */
  minDailyRestMinutes: number;
  /** Wochenend-/Wochenruhe (ARG §§ 3, 4: 2160 = 36 h). */
  weeklyRestMinutes: number;
  /** Nachtarbeitsfenster für Auswertung (Standard 22:00–06:00). */
  nightStart: string; // HH:MM
  nightEnd: string; // HH:MM
  /** Tagesgrenze, ab der Stunden als Überstunden gelten (Standard = normalDailyMinutes, Gleitzeit oft 600). */
  overtimeThresholdDailyMinutes: number;
  /** Wochengrenze für Überstunden (Standard = normalWeeklyMinutes). */
  overtimeThresholdWeeklyMinutes: number;
  /** Vollzeit-Wochenstunden des Betriebs (Grenze Mehrarbeit → Überstunden bei Teilzeit, AZG § 19d). */
  fullTimeWeeklyMinutes: number;
  /** Rundung von Buchungen (0 = keine). */
  roundingMinutes: 0 | 1 | 5 | 10 | 15;
  /** Pausen sind durch Betriebsvereinbarung/schriftliche Vereinbarung fix geregelt (AZG § 26 Abs 5) → keine Pausenaufzeichnung nötig. */
  fixedBreakAgreement: boolean;
  /** Bei fehlender Pause > 6 h automatisch 30 min abziehen (nur mit fixedBreakAgreement sinnvoll; wird im Journal ausgewiesen). */
  autoBreakDeduction: boolean;
  /** Reisezeit zählt als Arbeitszeit (AZG § 20b) – Standard true, eigener Bucket im Export. */
  travelCountsAsWork: boolean;
  /** Zusätzliche betriebliche Feiertage/Halbtage, MM-DD → Faktor (1 = frei, 0.5 = halber Tag). */
  extraHolidays: Record<string, number>;
  /** Standard-Arbeitstage ISO (1 = Mo … 7 = So). */
  defaultWorkDays: number[];
  /** Zeitzone des Betriebs. */
  timeZone: string;
}

export const DEFAULT_RULES: OrgRules = {
  normalDailyMinutes: 480,
  normalWeeklyMinutes: 2400,
  maxDailyMinutes: 720,
  maxWeeklyMinutes: 3600,
  avgWeeklyMinutes17w: 2880,
  breakAfterMinutes: 360,
  minBreakMinutes: 30,
  minDailyRestMinutes: 660,
  weeklyRestMinutes: 2160,
  nightStart: '22:00',
  nightEnd: '06:00',
  overtimeThresholdDailyMinutes: 480,
  overtimeThresholdWeeklyMinutes: 2400,
  fullTimeWeeklyMinutes: 2400,
  roundingMinutes: 0,
  fixedBreakAgreement: false,
  autoBreakDeduction: false,
  travelCountsAsWork: true,
  extraHolidays: { '12-24': 0.5, '12-31': 0.5 },
  defaultWorkDays: [1, 2, 3, 4, 5],
  timeZone: 'Europe/Vienna',
};

export interface Employment {
  /** Vertragliche Wochenarbeitszeit in Minuten. */
  weeklyMinutes: number;
  /** Arbeitstage ISO 1..7. */
  workDays: number[];
  /** Optionales Tagesmuster (Minuten je ISO-Wochentag), überschreibt gleichmäßige Verteilung. */
  dailyPattern?: Partial<Record<number, number>>;
  recordMode: RecordMode;
  /** Gleitzeitvereinbarung (AZG § 4b) – erlaubt 10 h Normalarbeitszeit. */
  gleitzeit: boolean;
  /** Urlaubsanspruch in Arbeitstagen pro Jahr (UrlG: 30 Werktage = 25 Arbeitstage bei 5-Tage-Woche). */
  vacationDaysPerYear: number;
  startDate?: ISODate;
  endDate?: ISODate | null;
  /** Zeitkonto-Saldo zu Beginn der Nutzung (Minuten, kann negativ sein). */
  openingBalanceMinutes: number;
  /** Überstundenpauschale/All-in: Überstunden werden ausgewiesen, aber als abgegolten markiert. */
  allIn: boolean;
  /** Vom AZG ausgenommen (z. B. leitende Angestellte, AZG § 1 Abs 2 Z 8) – Aufzeichnung ja, Grenzwert-Prüfung nein. */
  azgExempt?: boolean;
  /** Schriftliche Telearbeitsvereinbarung liegt vor (§ 2h AVRAG). */
  teleworkAgreement?: boolean;
  /** Soll-Ermittlung: aus Vertrag (gleichmäßig auf Arbeitstage) oder aus dem veröffentlichten Dienstplan. */
  targetMode?: 'contract' | 'plan';
  /** Veröffentlichte Schichten am Folgetag automatisch als Ist übernehmen, wenn nichts gestempelt wurde (Bestätigung beim Monatsabschluss). */
  autoAdoptPlan?: boolean;
}

export const DEFAULT_EMPLOYMENT: Employment = {
  weeklyMinutes: 2400,
  workDays: [1, 2, 3, 4, 5],
  recordMode: 'full',
  gleitzeit: false,
  vacationDaysPerYear: 25,
  openingBalanceMinutes: 0,
  allIn: false,
};

export interface TimeEntry {
  id: string;
  userId: string;
  date: ISODate;
  startAt: ISOInstant | null;
  endAt: ISOInstant | null;
  breakMinutes: number;
  /** Nur bei recordMode duration_only oder Importen ohne Uhrzeiten. */
  durationMinutes: number | null;
  type: EntryType;
  location: EntryLocation;
  projectId: string | null;
  note: string | null;
  source: EntrySource;
  status: EntryStatus;
}

export interface Absence {
  id: string;
  userId: string;
  dateFrom: ISODate;
  dateTo: ISODate;
  type: AbsenceType;
  /** 1 = ganzer Tag, 0.5 = halber Tag (nur bei eintägigen Abwesenheiten). */
  portion: 1 | 0.5;
  note: string | null;
  status: 'requested' | 'approved' | 'rejected';
}

export type ViolationCode =
  | 'DAILY_MAX_EXCEEDED'
  | 'NORMAL_DAILY_EXCEEDED'
  | 'BREAK_MISSING'
  | 'REST_TOO_SHORT'
  | 'WEEKLY_MAX_EXCEEDED'
  | 'AVG_17W_EXCEEDED'
  | 'WEEKEND_REST_SHORT'
  | 'SUNDAY_WORK'
  | 'HOLIDAY_WORK'
  | 'NIGHT_WORK'
  | 'ENTRY_OVERLAP'
  | 'ENTRY_OPEN'
  | 'ENTRY_ON_ABSENCE_DAY'
  | 'DURATION_ONLY_WITHOUT_DURATION';

export type Severity = 'error' | 'warn' | 'info';

export interface Violation {
  code: ViolationCode;
  severity: Severity;
  date: ISODate;
  message: string;
  legalRef: string;
  minutes?: number;
  entryIds?: string[];
}

export interface DayResult {
  date: ISODate;
  weekday: number; // ISO 1..7
  isHoliday: boolean;
  holidayName?: string;
  holidayFactor: number; // 0..1
  isWorkDay: boolean;
  targetMinutes: number; // Soll
  workedMinutes: number; // Ist (inkl. Reisezeit wenn travelCountsAsWork)
  travelMinutes: number;
  oncallMinutes: number;
  breakMinutes: number;
  autoBreakMinutes: number;
  nightMinutes: number;
  creditMinutes: number; // Gutschrift durch Feiertag/Urlaub/Krankenstand etc.
  timeCompMinutes: number; // Zeitausgleich-Verbrauch
  absenceType?: AbsenceType;
  absencePortion?: number;
  overtimeMinutes: number; // täglich ermittelte Überstunden (über Tagesgrenze)
  firstStart: ISOInstant | null;
  lastEnd: ISOInstant | null;
  locations: Partial<Record<EntryLocation, number>>;
  projects: Record<string, number>; // projectId|'none' → minutes
  entries: TimeEntry[];
  violations: Violation[];
}

export interface WeekResult {
  isoWeek: string; // 2026-W45
  workedMinutes: number;
  targetMinutes: number;
  overtimeMinutes: number; // wöchentlich zusätzlich (über Tages-ÜSt hinaus)
  violations: Violation[];
}

export interface PeriodSummary {
  userId: string;
  year: number;
  month: number; // 1..12
  from: ISODate;
  to: ISODate;
  days: DayResult[];
  weeks: WeekResult[];
  targetMinutes: number;
  workedMinutes: number;
  travelMinutes: number;
  oncallMinutes: number;
  creditMinutes: number;
  timeCompMinutes: number;
  balanceStartMinutes: number;
  balanceEndMinutes: number;
  /** Überstunden gesamt (Tages- + Wochenmethode, ohne Doppelzählung). */
  overtimeMinutes: number;
  /** Mehrarbeit bei Teilzeit bis Vollzeitgrenze (AZG § 19d). */
  mehrarbeitMinutes: number;
  /** Überstunden mit 100 %-Indikation (Nacht/Sonn-/Feiertag) – endgültige Zuschläge laut KV. */
  overtime100Minutes: number;
  overtime50Minutes: number;
  nightMinutes: number;
  sundayMinutes: number;
  holidayMinutes: number;
  absenceDays: Record<AbsenceType, number>;
  holidayDays: number;
  remoteOnlyDays: number;
  workedDays: number;
  oncallDays: number;
  byProject: Record<string, number>;
  byLocation: Partial<Record<EntryLocation, number>>;
  violations: Violation[];
  errorCount: number;
  warnCount: number;
}
