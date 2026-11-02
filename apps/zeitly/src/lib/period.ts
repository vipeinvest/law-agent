import 'server-only';
import type { DbClient } from '@/db/client';
import { evaluatePeriod } from '@/domain/rules';
import type { PeriodSummary } from '@/domain/types';
import { addDays, monthRange } from '@/domain/time';
import { orgRules, userEmployment, type OrgRow, type UserRow } from './org';
import { getPeriod, latestClosedPeriodBefore, listAbsences, listEntries, listProjects, toAbsence, toEntry, type PeriodRow, type ProjectRow } from './repo';

export interface EvaluatedPeriod {
  summary: PeriodSummary;
  period: PeriodRow | null;
  projects: ProjectRow[];
}

function prevMonth(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}
function ym(y: number, m: number): number {
  return y * 100 + m;
}

/** Starting balance for a month: last approved period before it, then evaluate the gap months. */
export async function balanceStart(db: DbClient, org: OrgRow, user: UserRow, year: number, month: number): Promise<number> {
  const rules = orgRules(org);
  const emp = userEmployment(user, rules);
  const closed = await latestClosedPeriodBefore(db, org.id, user.id, year, month);
  let balance = closed ? closed.balance_end : emp.openingBalanceMinutes;
  let [cy, cm] = closed ? (closed.month === 12 ? [closed.year + 1, 1] : [closed.year, closed.month + 1]) : startMonth(emp.startDate, user.created_at);
  let guard = 0;
  while (ym(cy, cm) < ym(year, month) && guard++ < 120) {
    const s = await evaluateMonth(db, org, user, cy, cm, balance);
    balance = s.balanceEndMinutes;
    [cy, cm] = cm === 12 ? [cy + 1, 1] : [cy, cm + 1];
  }
  return balance;
}

function startMonth(startDate: string | undefined, createdAt: string): [number, number] {
  const d = startDate || createdAt.slice(0, 10);
  return [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
}

export async function evaluateMonth(db: DbClient, org: OrgRow, user: UserRow, year: number, month: number, balanceStartMinutes: number, now?: string): Promise<PeriodSummary> {
  const rules = orgRules(org);
  const employment = userEmployment(user, rules);
  const { from, to } = monthRange(year, month);
  const [entriesRows, absenceRows] = await Promise.all([listEntries(db, org.id, user.id, addDays(from, -14), addDays(to, 7)), listAbsences(db, org.id, user.id, addDays(from, -14), addDays(to, 7))]);
  return evaluatePeriod({
    userId: user.id,
    year,
    month,
    rules,
    employment,
    entries: entriesRows.map(toEntry),
    absences: absenceRows.map(toAbsence),
    balanceStartMinutes,
    now,
  });
}

export async function evaluateUserMonth(db: DbClient, org: OrgRow, user: UserRow, year: number, month: number): Promise<EvaluatedPeriod> {
  const period = await getPeriod(db, org.id, user.id, year, month);
  const start = period && (period.status === 'approved' || period.status === 'exported') ? period.balance_start : await balanceStart(db, org, user, year, month);
  const summary = await evaluateMonth(db, org, user, year, month, start);
  const projects = await listProjects(db, org.id, false);
  return { summary, period, projects };
}

export { prevMonth };
