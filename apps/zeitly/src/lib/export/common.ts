import 'server-only';
import type { DbClient } from '@/db/client';
import type { Session } from '../auth';
import { evaluateUserMonth } from '../period';
import { listProjects, visibleUsers, type PeriodRow, type ProjectRow } from '../repo';
import { orgRules, userEmployment, type UserRow } from '../org';
import type { PeriodSummary } from '@/domain/types';

export interface EmployeeMonth {
  user: UserRow;
  summary: PeriodSummary;
  period: PeriodRow | null;
  weeklyMinutes: number;
}

export interface OrgMonth {
  year: number;
  month: number;
  employees: EmployeeMonth[];
  projects: ProjectRow[];
}

/** Evaluate all employees visible to the viewer for one month (employees with a time-recording role only). */
export async function evaluateOrgMonth(db: DbClient, s: Session, year: number, month: number, userIds?: string[]): Promise<OrgMonth> {
  const users = (await visibleUsers(db, s.user)).filter((u) => u.role !== 'payroll' && (!userIds || userIds.includes(u.id)));
  const rules = orgRules(s.org);
  const projects = await listProjects(db, s.org.id, false);
  const employees: EmployeeMonth[] = [];
  for (const user of users) {
    const { summary, period } = await evaluateUserMonth(db, s.org, user, year, month);
    employees.push({ user, summary, period, weeklyMinutes: userEmployment(user, rules).weeklyMinutes });
  }
  return { year, month, employees, projects };
}

export function hoursDecimal(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

export function fileSafe(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function projectLabel(projects: ProjectRow[], id: string): string {
  if (id === 'none') return 'Ohne Projekt';
  const p = projects.find((x) => x.id === id);
  return p ? `${p.code} – ${p.name}` : 'Unbekannt';
}
