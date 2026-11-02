import { describe, expect, it } from 'vitest';
import { evaluatePeriod, entryNetMinutes, liveHints } from '@/domain/rules';
import { DEFAULT_EMPLOYMENT, DEFAULT_RULES, type Absence, type TimeEntry } from '@/domain/types';
import { easterSunday, statutoryHolidaysAT } from '@/domain/holidays';
import { formatMinutes, isoWeekKey, isoWeekday, localDateTimeToInstant, nightOverlapMinutes, toISODate } from '@/domain/time';

const TZ = 'Europe/Vienna';
let seq = 0;
function entry(date: string, start: string, end: string, breakMinutes = 0, extra: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `e${++seq}`,
    userId: 'u1',
    date,
    startAt: localDateTimeToInstant(date, start, TZ),
    endAt: localDateTimeToInstant(date, end, TZ),
    breakMinutes,
    durationMinutes: null,
    type: 'work',
    location: 'office',
    projectId: null,
    note: null,
    source: 'manual',
    status: 'open',
    ...extra,
  };
}
function evalMonth(entries: TimeEntry[], absences: Absence[] = [], opts: Partial<Parameters<typeof evaluatePeriod>[0]> = {}) {
  return evaluatePeriod({
    userId: 'u1',
    year: 2026,
    month: 11,
    rules: DEFAULT_RULES,
    employment: DEFAULT_EMPLOYMENT,
    entries,
    absences,
    balanceStartMinutes: 0,
    now: '2026-12-01T06:00:00.000Z',
    ...opts,
  });
}

describe('time helpers', () => {
  it('converts Vienna local time to UTC across DST', () => {
    expect(localDateTimeToInstant('2026-07-01', '09:00', TZ)).toBe('2026-07-01T07:00:00.000Z');
    expect(localDateTimeToInstant('2026-11-02', '09:00', TZ)).toBe('2026-11-02T08:00:00.000Z');
    expect(toISODate('2026-11-02T23:30:00.000Z', TZ)).toBe('2026-11-03');
  });
  it('computes ISO weekdays and weeks', () => {
    expect(isoWeekday('2026-11-02')).toBe(1); // Monday
    expect(isoWeekday('2026-11-08')).toBe(7);
    expect(isoWeekKey('2026-11-02')).toBe('2026-W45');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
  });
  it('formats minutes', () => {
    expect(formatMinutes(490)).toBe('8:10');
    expect(formatMinutes(-75)).toBe('-1:15');
    expect(formatMinutes(30, { sign: true })).toBe('+0:30');
  });
  it('computes night overlap 22:00–06:00', () => {
    const s = localDateTimeToInstant('2026-11-02', '20:00', TZ);
    const e = localDateTimeToInstant('2026-11-03', '01:30', TZ);
    expect(nightOverlapMinutes(s, e, '22:00', '06:00', TZ)).toBe(210);
    expect(nightOverlapMinutes(localDateTimeToInstant('2026-11-02', '08:00', TZ), localDateTimeToInstant('2026-11-02', '17:00', TZ), '22:00', '06:00', TZ)).toBe(0);
  });
});

describe('holidays AT', () => {
  it('computes Easter correctly', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2025)).toBe('2025-04-20');
  });
  it('lists 13 statutory holidays incl. movable ones', () => {
    const h = statutoryHolidaysAT(2026);
    expect(h).toHaveLength(13);
    const names = Object.fromEntries(h.map((x) => [x.name, x.date]));
    expect(names['Ostermontag']).toBe('2026-04-06');
    expect(names['Christi Himmelfahrt']).toBe('2026-05-14');
    expect(names['Pfingstmontag']).toBe('2026-05-25');
    expect(names['Fronleichnam']).toBe('2026-06-04');
    expect(names['Nationalfeiertag']).toBe('2026-10-26');
  });
});

describe('entryNetMinutes', () => {
  it('subtracts breaks and applies rounding', () => {
    const e = entry('2026-11-02', '08:00', '16:37', 30);
    expect(entryNetMinutes(e, DEFAULT_RULES)).toBe(487);
    expect(entryNetMinutes(e, { ...DEFAULT_RULES, roundingMinutes: 15 })).toBe(480);
  });
  it('uses durationMinutes for duration-only entries', () => {
    const e: TimeEntry = { ...entry('2026-11-02', '08:00', '09:00'), startAt: null, endAt: null, durationMinutes: 300 };
    expect(entryNetMinutes(e, DEFAULT_RULES)).toBe(300);
  });
});

describe('evaluatePeriod – Soll/Ist/Saldo', () => {
  it('computes November 2026 target for full time (21 work days, 1.11. is Sunday → no holiday credit)', () => {
    const r = evalMonth([]);
    // November 2026: 30 days, 21 Mon–Fri; Allerheiligen falls on Sunday
    expect(r.targetMinutes).toBe(21 * 480);
    expect(r.holidayDays).toBe(0);
    expect(r.balanceEndMinutes).toBe(-21 * 480);
  });
  it('credits statutory holidays on work days (December 2026: 8.12. Tue, 25.12. Fri, 24./31.12. half)', () => {
    const r = evaluatePeriod({ userId: 'u1', year: 2026, month: 12, rules: DEFAULT_RULES, employment: DEFAULT_EMPLOYMENT, entries: [], absences: [], balanceStartMinutes: 0, now: '2027-01-02T00:00:00Z' });
    // 23 weekdays in Dec 2026; holidays on weekdays: 8.12 (Tue), 25.12 (Fri) → 2 full; 24.12 (Thu), 31.12 (Thu) → 2 × 0.5
    expect(r.targetMinutes).toBe(23 * 480);
    expect(r.holidayDays).toBe(3);
    expect(r.creditMinutes).toBe(3 * 480);
  });
  it('balances a normal week to zero', () => {
    const entries = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => entry(d, '08:00', '16:30', 30));
    const r = evalMonth(entries);
    expect(r.workedMinutes).toBe(5 * 480);
    expect(r.weeks.find((w) => w.isoWeek === '2026-W45')?.workedMinutes).toBe(2400);
    expect(r.overtimeMinutes).toBe(0);
    expect(r.errorCount).toBe(0);
  });
  it('vacation and sick days credit the daily target; time compensation consumes balance', () => {
    const absences: Absence[] = [
      { id: 'a1', userId: 'u1', dateFrom: '2026-11-02', dateTo: '2026-11-03', type: 'vacation', portion: 1, note: null, status: 'approved' },
      { id: 'a2', userId: 'u1', dateFrom: '2026-11-04', dateTo: '2026-11-04', type: 'sick', portion: 1, note: null, status: 'approved' },
      { id: 'a3', userId: 'u1', dateFrom: '2026-11-05', dateTo: '2026-11-05', type: 'time_comp', portion: 1, note: null, status: 'approved' },
      { id: 'a4', userId: 'u1', dateFrom: '2026-11-06', dateTo: '2026-11-06', type: 'vacation', portion: 0.5, note: null, status: 'approved' },
      { id: 'a5', userId: 'u1', dateFrom: '2026-11-09', dateTo: '2026-11-09', type: 'vacation', portion: 1, note: null, status: 'requested' },
    ];
    const r = evalMonth([entry('2026-11-06', '08:00', '12:00')], absences);
    expect(r.absenceDays.vacation).toBe(2.5);
    expect(r.absenceDays.sick).toBe(1);
    expect(r.absenceDays.time_comp).toBe(1);
    expect(r.creditMinutes).toBe(3 * 480 + 240);
    expect(r.timeCompMinutes).toBe(480);
    const d5 = r.days.find((d) => d.date === '2026-11-05')!;
    expect(d5.creditMinutes).toBe(0);
    expect(d5.targetMinutes).toBe(480);
  });
  it('applies opening balance and carries forward', () => {
    const r = evalMonth([entry('2026-11-02', '08:00', '18:00', 30)], [], { balanceStartMinutes: 120 });
    expect(r.balanceEndMinutes).toBe(120 + 570 - 21 * 480);
  });
  it('respects employment start date', () => {
    const r = evalMonth([], [], { employment: { ...DEFAULT_EMPLOYMENT, startDate: '2026-11-16' } });
    expect(r.targetMinutes).toBe(11 * 480); // 16.–30.11. = 11 work days
  });
});

describe('evaluatePeriod – AZG checks', () => {
  it('flags missing break after more than 6 hours', () => {
    const r = evalMonth([entry('2026-11-02', '08:00', '15:00', 0)]);
    expect(r.violations.map((x) => x.code)).toContain('BREAK_MISSING');
    const ok = evalMonth([entry('2026-11-02', '08:00', '15:00', 30)]);
    expect(ok.violations.map((x) => x.code)).not.toContain('BREAK_MISSING');
    const short = evalMonth([entry('2026-11-02', '08:00', '14:00', 0)]); // exactly 6 h → no break needed
    expect(short.violations.map((x) => x.code)).not.toContain('BREAK_MISSING');
  });
  it('does not require break recording with fixed break agreement and can auto-deduct', () => {
    const rules = { ...DEFAULT_RULES, fixedBreakAgreement: true, autoBreakDeduction: true };
    const r = evalMonth([entry('2026-11-02', '08:00', '17:00', 0)], [], { rules });
    expect(r.violations.map((x) => x.code)).not.toContain('BREAK_MISSING');
    const d = r.days.find((x) => x.date === '2026-11-02')!;
    expect(d.autoBreakMinutes).toBe(30);
    expect(d.workedMinutes).toBe(510);
  });
  it('flags daily maximum of 12 h and warns above 10 h', () => {
    const r = evalMonth([entry('2026-11-02', '06:00', '19:30', 60)]); // 12:30 net
    expect(r.violations.find((x) => x.code === 'DAILY_MAX_EXCEEDED')?.severity).toBe('error');
    const w = evalMonth([entry('2026-11-03', '07:00', '18:30', 30)]); // 11:00 net
    expect(w.violations.map((x) => x.code)).toContain('NORMAL_DAILY_EXCEEDED');
    expect(w.violations.map((x) => x.code)).not.toContain('DAILY_MAX_EXCEEDED');
  });
  it('flags rest period shorter than 11 h between days', () => {
    const r = evalMonth([entry('2026-11-02', '12:00', '22:30', 30), entry('2026-11-03', '07:00', '15:30', 30)]);
    const viol = r.violations.find((x) => x.code === 'REST_TOO_SHORT');
    expect(viol).toBeTruthy();
    expect(viol?.date).toBe('2026-11-03');
    expect(viol?.minutes).toBe(660 - 510);
  });
  it('flags weekly maximum of 60 h', () => {
    const entries = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => entry(d, '06:00', '18:30', 30)); // 12 h × 5 = 60 h
    const sat = entry('2026-11-07', '08:00', '10:00');
    const r = evalMonth([...entries, sat]);
    expect(r.violations.map((x) => x.code)).toContain('WEEKLY_MAX_EXCEEDED');
    expect(r.weeks.find((w) => w.isoWeek === '2026-W45')?.workedMinutes).toBe(3720);
  });
  it('detects overlaps and open entries', () => {
    const r = evalMonth([entry('2026-11-02', '08:00', '12:00'), entry('2026-11-02', '11:30', '15:00'), { ...entry('2026-11-03', '08:00', '09:00'), endAt: null }]);
    const codes = r.violations.map((x) => x.code);
    expect(codes).toContain('ENTRY_OVERLAP');
    expect(codes).toContain('ENTRY_OPEN');
  });
  it('reports Sunday/holiday/night work as info and weekend rest', () => {
    const r = evalMonth([entry('2026-11-07', '14:00', '23:00', 30), entry('2026-11-08', '10:00', '14:00'), entry('2026-11-09', '06:00', '14:00', 30)]);
    const codes = r.violations.map((x) => x.code);
    expect(codes).toContain('SUNDAY_WORK');
    expect(codes).toContain('NIGHT_WORK');
    expect(codes).toContain('WEEKEND_REST_SHORT');
    expect(r.sundayMinutes).toBe(240);
    expect(r.nightMinutes).toBe(60);
  });
  it('counts statutory holiday work (26.10.2026 is a Monday)', () => {
    const r = evaluatePeriod({ userId: 'u1', year: 2026, month: 10, rules: DEFAULT_RULES, employment: DEFAULT_EMPLOYMENT, entries: [entry('2026-10-26', '08:00', '12:00')], absences: [], balanceStartMinutes: 0, now: '2026-11-01T00:00:00Z' });
    expect(r.violations.map((x) => x.code)).toContain('HOLIDAY_WORK');
    expect(r.holidayMinutes).toBe(240);
    const d = r.days.find((x) => x.date === '2026-10-26')!;
    expect(d.creditMinutes).toBe(480); // holiday credit stays, work on top
  });
});

describe('evaluatePeriod – overtime & Mehrarbeit', () => {
  it('daily overtime above 8 h', () => {
    const r = evalMonth([entry('2026-11-02', '08:00', '18:30', 30)]); // 10 h
    expect(r.overtimeMinutes).toBe(120);
    expect(r.overtime50Minutes).toBe(120);
    expect(r.overtime100Minutes).toBe(0);
  });
  it('gleitzeit raises daily threshold to 10 h', () => {
    const r = evalMonth([entry('2026-11-02', '08:00', '18:30', 30)], [], { employment: { ...DEFAULT_EMPLOYMENT, gleitzeit: true } });
    expect(r.overtimeMinutes).toBe(0);
  });
  it('weekly overtime when six 8-hour days exceed 40 h', () => {
    const entries = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map((d) => entry(d, '08:00', '16:30', 30));
    const r = evalMonth(entries);
    expect(r.overtimeMinutes).toBe(480);
    expect(r.weeks.find((w) => w.isoWeek === '2026-W45')?.overtimeMinutes).toBe(480);
  });
  it('part-time: hours above contract up to full time are Mehrarbeit, beyond are overtime', () => {
    const emp = { ...DEFAULT_EMPLOYMENT, weeklyMinutes: 1200, workDays: [1, 2, 3, 4, 5] }; // 20 h, 4 h/day
    const entries = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => entry(d, '08:00', '14:30', 30)); // 6 h × 5 = 30 h
    const r = evalMonth(entries, [], { employment: emp });
    expect(r.mehrarbeitMinutes).toBe(600);
    expect(r.overtimeMinutes).toBe(0);
    const heavy = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((d) => entry(d, '07:00', '16:30', 30)); // 9 h × 5 = 45 h
    const r2 = evalMonth(heavy, [], { employment: emp });
    expect(r2.overtimeMinutes).toBe(300); // 1 h/day above 8 h
    expect(r2.mehrarbeitMinutes).toBe(1200); // 40 h - 20 h
  });
  it('night/sunday share is reported as 100 % indication', () => {
    const r = evalMonth([entry('2026-11-08', '08:00', '17:30', 30)]); // Sunday 9 h → 1 h overtime, all on Sunday
    expect(r.overtimeMinutes).toBe(60);
    expect(r.overtime100Minutes).toBe(60);
    expect(r.overtime50Minutes).toBe(0);
  });
  it('project and location split, remote-only days', () => {
    const r = evalMonth([
      entry('2026-11-02', '08:00', '12:00', 0, { location: 'remote', projectId: 'p1' }),
      entry('2026-11-02', '12:30', '16:30', 0, { location: 'remote', projectId: 'p2' }),
      entry('2026-11-03', '08:00', '12:00', 0, { location: 'remote' }),
      entry('2026-11-03', '13:00', '17:00', 0, { location: 'office' }),
    ]);
    expect(r.byProject).toEqual({ p1: 240, p2: 240, none: 480 });
    expect(r.byLocation.remote).toBe(720);
    expect(r.remoteOnlyDays).toBe(1);
    expect(r.workedDays).toBe(2);
  });
  it('travel time counted as work but reported separately', () => {
    const r = evalMonth([entry('2026-11-02', '06:00', '08:00', 0, { type: 'travel' }), entry('2026-11-02', '08:00', '16:30', 30)]);
    expect(r.travelMinutes).toBe(120);
    expect(r.workedMinutes).toBe(600);
    const r2 = evalMonth([entry('2026-11-02', '06:00', '08:00', 0, { type: 'travel' })], [], { rules: { ...DEFAULT_RULES, travelCountsAsWork: false } });
    expect(r2.workedMinutes).toBe(0);
    expect(r2.travelMinutes).toBe(120);
  });
});

describe('liveHints', () => {
  it('reminds about breaks and limits', () => {
    expect(liveHints(370, 0, DEFAULT_RULES, false)[0]).toMatch(/Pause/);
    expect(liveHints(500, 30, DEFAULT_RULES, false).join(' ')).toMatch(/Überstunden/);
    expect(liveHints(700, 30, DEFAULT_RULES, true).join(' ')).toMatch(/12 Stunden/);
    expect(liveHints(300, 0, DEFAULT_RULES, false)).toHaveLength(0);
  });
});

describe('gaps and exemptions', () => {
  it('counts the gap between two entries on the same day as a break', () => {
    const r = evalMonth([entry('2026-11-02', '08:00', '12:00'), entry('2026-11-02', '12:45', '17:00')]);
    expect(r.violations.map((x) => x.code)).not.toContain('BREAK_MISSING');
    expect(r.days.find((d) => d.date === '2026-11-02')!.breakMinutes).toBe(45);
  });
  it('suppresses limit checks for AZG-exempt employees but keeps data checks', () => {
    const r = evalMonth([entry('2026-11-02', '06:00', '20:00', 0), entry('2026-11-02', '19:00', '21:00', 0)], [], { employment: { ...DEFAULT_EMPLOYMENT, azgExempt: true } });
    const codes = r.violations.map((x) => x.code);
    expect(codes).not.toContain('DAILY_MAX_EXCEEDED');
    expect(codes).not.toContain('BREAK_MISSING');
    expect(codes).toContain('ENTRY_OVERLAP');
  });
  it('counts on-call days separately', () => {
    const r = evalMonth([entry('2026-11-07', '18:00', '22:00', 0, { type: 'oncall' }), entry('2026-11-02', '08:00', '16:30', 30)]);
    expect(r.oncallDays).toBe(1);
    expect(r.oncallMinutes).toBe(240);
    expect(r.workedDays).toBe(1);
  });
});
