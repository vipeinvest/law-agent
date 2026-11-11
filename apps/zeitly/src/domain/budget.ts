/**
 * Labour-cost budgeting for the roster (pure functions, no I/O).
 * Planned hours x hourly employer cost per person, compared with a weekly budget – visible while planning,
 * before the roster is published. Employees without a cost rate are counted in hours and listed as "uncosted".
 */
export interface PlanShiftLike {
  userId: string;
  date: string;
  start: string; // HH:MM local
  end: string; // HH:MM local (may be past midnight)
  breakMinutes: number;
}

export interface LaborPlanSummary {
  /** planned net minutes of all shifts */
  minutes: number;
  /** planned cost in EUR of all shifts that have a cost rate (2 decimals) */
  cost: number;
  perUser: Record<string, { minutes: number; cost: number | null }>;
  /** user ids with planned shifts but without a cost rate – their hours are not in `cost` */
  uncosted: string[];
  budget: number | null;
  /** cost / budget (1 = exactly on budget); null without budget */
  utilization: number | null;
  /** budget - cost; negative = over budget; null without budget */
  remaining: number | null;
  status: 'none' | 'ok' | 'tight' | 'over';
}

export function shiftNetMinutes(s: Pick<PlanShiftLike, 'start' | 'end' | 'breakMinutes'>): number {
  const [sh, sm] = s.start.split(':').map(Number);
  const [eh, em] = s.end.split(':').map(Number);
  let gross = eh * 60 + em - (sh * 60 + sm);
  if (gross <= 0) gross += 1440;
  return Math.max(0, gross - (s.breakMinutes || 0));
}

const cents = (eur: number) => Math.round(eur * 100) / 100;

/** `hourlyCost`: EUR per hour including employer on-costs, per user id. `tightFrom`: utilization that counts as "tight". */
export function summarizeLaborPlan(shifts: PlanShiftLike[], hourlyCost: Record<string, number | null | undefined>, budget?: number | null, tightFrom = 0.9): LaborPlanSummary {
  const perUser: LaborPlanSummary['perUser'] = {};
  let minutes = 0;
  for (const s of shifts) {
    const m = shiftNetMinutes(s);
    minutes += m;
    const u = (perUser[s.userId] ??= { minutes: 0, cost: null });
    u.minutes += m;
  }
  let cost = 0;
  const uncosted: string[] = [];
  for (const [id, u] of Object.entries(perUser)) {
    const rate = hourlyCost[id];
    if (typeof rate === 'number' && rate > 0) {
      u.cost = cents((u.minutes / 60) * rate);
      cost += u.cost;
    } else if (u.minutes > 0) uncosted.push(id);
  }
  cost = cents(cost);
  const b = typeof budget === 'number' && budget > 0 ? budget : null;
  const utilization = b ? cost / b : null;
  const status: LaborPlanSummary['status'] = utilization === null ? 'none' : utilization > 1 ? 'over' : utilization >= tightFrom ? 'tight' : 'ok';
  return { minutes, cost, perUser, uncosted, budget: b, utilization, remaining: b ? cents(b - cost) : null, status };
}

export interface AbsenceLike {
  userId: string;
  from: string; // ISO date
  to: string; // ISO date
  type: string;
  status: 'requested' | 'approved' | 'rejected';
  halfDay?: boolean;
}

/** The absence (approved first, then requested) that covers the given day for the user, if any. Rejected ones are ignored. */
export function absenceOn(absences: AbsenceLike[], userId: string, date: string): AbsenceLike | null {
  const hits = absences.filter((a) => a.userId === userId && a.status !== 'rejected' && a.from <= date && a.to >= date);
  return hits.find((a) => a.status === 'approved') ?? hits[0] ?? null;
}
