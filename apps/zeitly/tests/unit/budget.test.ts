import { describe, expect, it } from 'vitest';
import { absenceOn, shiftNetMinutes, summarizeLaborPlan } from '@/domain/budget';

const sh = (userId: string, date: string, start: string, end: string, breakMinutes = 30) => ({ userId, date, start, end, breakMinutes });

describe('labour-cost budget', () => {
  it('computes net minutes including shifts past midnight', () => {
    expect(shiftNetMinutes({ start: '08:00', end: '16:30', breakMinutes: 30 })).toBe(480);
    expect(shiftNetMinutes({ start: '22:00', end: '06:00', breakMinutes: 0 })).toBe(480);
    expect(shiftNetMinutes({ start: '09:00', end: '09:20', breakMinutes: 30 })).toBe(0);
  });

  it('sums cost per person and compares with the weekly budget', () => {
    const shifts = [sh('a', '2026-11-09', '08:00', '16:30'), sh('a', '2026-11-10', '08:00', '16:30'), sh('b', '2026-11-09', '08:00', '12:00', 0)];
    const r = summarizeLaborPlan(shifts, { a: 28.5, b: 22 }, 600);
    expect(r.minutes).toBe(1200);
    expect(r.perUser.a).toEqual({ minutes: 960, cost: 456 });
    expect(r.perUser.b).toEqual({ minutes: 240, cost: 88 });
    expect(r.cost).toBe(544);
    expect(r.remaining).toBe(56);
    expect(r.utilization).toBeCloseTo(0.9067, 3);
    expect(r.status).toBe('tight');
  });

  it('flags plans over budget and lists people without a cost rate', () => {
    const shifts = [sh('a', '2026-11-09', '08:00', '16:30'), sh('c', '2026-11-09', '08:00', '16:30')];
    const r = summarizeLaborPlan(shifts, { a: 30 }, 200);
    expect(r.cost).toBe(240);
    expect(r.status).toBe('over');
    expect(r.remaining).toBe(-40);
    expect(r.uncosted).toEqual(['c']);
    expect(r.perUser.c.cost).toBeNull();
  });

  it('works without a budget and rounds to cents', () => {
    const r = summarizeLaborPlan([sh('a', '2026-11-09', '08:00', '12:10', 0)], { a: 19.99 });
    expect(r.budget).toBeNull();
    expect(r.status).toBe('none');
    expect(r.cost).toBe(83.29);
  });

  it('finds the absence covering a day, preferring approved ones and ignoring rejected ones', () => {
    const abs = [
      { userId: 'a', from: '2026-11-09', to: '2026-11-11', type: 'vacation', status: 'requested' as const },
      { userId: 'a', from: '2026-11-10', to: '2026-11-10', type: 'sick', status: 'approved' as const },
      { userId: 'a', from: '2026-11-12', to: '2026-11-12', type: 'vacation', status: 'rejected' as const },
    ];
    expect(absenceOn(abs, 'a', '2026-11-09')?.type).toBe('vacation');
    expect(absenceOn(abs, 'a', '2026-11-10')?.type).toBe('sick');
    expect(absenceOn(abs, 'a', '2026-11-12')).toBeNull();
    expect(absenceOn(abs, 'b', '2026-11-10')).toBeNull();
  });
});
