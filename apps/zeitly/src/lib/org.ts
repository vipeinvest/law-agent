import 'server-only';
import type { DbClient } from '@/db/client';
import { DEFAULT_EMPLOYMENT, DEFAULT_RULES, type Employment, type OrgRules, type Role } from '@/domain/types';

export interface OrgTheme {
  primary: string; // hex
  accent: string; // hex
  logoDataUrl: string | null;
  logoText: string | null;
  appName: string | null;
  radius: 'soft' | 'round' | 'square';
}

export const DEFAULT_THEME: OrgTheme = {
  primary: '#1f5f5b',
  accent: '#e07a2f',
  logoDataUrl: null,
  logoText: null,
  appName: null,
  radius: 'round',
};

export interface OrgRow {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  address: string | null;
  uid_number: string | null;
  contact_email: string | null;
  payroll_email: string | null;
  settings: Partial<OrgRules> & Record<string, unknown>;
  theme: Partial<OrgTheme>;
  time_zone: string;
  plan: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: Role;
  employment: Partial<Employment>;
  manager_id: string | null;
  personnel_no: string | null;
  active: boolean;
  invited_at: string | null;
  last_login_at: string | null;
  consent_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export function orgRules(org: Pick<OrgRow, 'settings' | 'time_zone'>): OrgRules {
  const s = org.settings || {};
  const rules: OrgRules = { ...DEFAULT_RULES, ...pickRules(s), timeZone: org.time_zone || DEFAULT_RULES.timeZone };
  if (!s.overtimeThresholdDailyMinutes) rules.overtimeThresholdDailyMinutes = rules.normalDailyMinutes;
  if (!s.overtimeThresholdWeeklyMinutes) rules.overtimeThresholdWeeklyMinutes = rules.normalWeeklyMinutes;
  if (!s.fullTimeWeeklyMinutes) rules.fullTimeWeeklyMinutes = rules.normalWeeklyMinutes;
  return rules;
}

function pickRules(s: Record<string, unknown>): Partial<OrgRules> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_RULES) as Array<keyof OrgRules>) {
    if (s[k] !== undefined && s[k] !== null && s[k] !== '') out[k] = s[k];
  }
  return out as Partial<OrgRules>;
}

export function orgTheme(org: Pick<OrgRow, 'theme' | 'name'>): OrgTheme {
  return { ...DEFAULT_THEME, ...(org.theme || {}) };
}

export function userEmployment(u: Pick<UserRow, 'employment'>, rules?: OrgRules): Employment {
  const base: Employment = { ...DEFAULT_EMPLOYMENT, workDays: rules?.defaultWorkDays ?? DEFAULT_EMPLOYMENT.workDays, weeklyMinutes: rules?.normalWeeklyMinutes ?? DEFAULT_EMPLOYMENT.weeklyMinutes };
  const e = u.employment || {};
  return { ...base, ...e, workDays: Array.isArray(e.workDays) && e.workDays.length ? e.workDays : base.workDays };
}

export async function getOrgById(db: DbClient, id: string): Promise<OrgRow | null> {
  const { rows } = await db.query<OrgRow>(`select * from zt_orgs where id = $1 and deleted_at is null`, [id]);
  return rows[0] ?? null;
}

export async function getOrgBySlug(db: DbClient, slug: string): Promise<OrgRow | null> {
  const { rows } = await db.query<OrgRow>(`select * from zt_orgs where slug = $1 and deleted_at is null`, [slug.toLowerCase()]);
  return rows[0] ?? null;
}

/** CSS custom properties for the tenant theme (RGB triplets for Tailwind alpha support). */
export function themeCss(theme: OrgTheme): string {
  const p = hexToRgb(theme.primary) ?? [31, 95, 91];
  const a = hexToRgb(theme.accent) ?? [224, 122, 47];
  const fg = luminance(p) > 0.55 ? [17, 24, 39] : [255, 255, 255];
  const soft = p.map((c) => Math.round(c + (255 - c) * 0.88));
  const radius = theme.radius === 'square' ? '6px' : theme.radius === 'soft' ? '10px' : '14px';
  return `:root{--brand:${p.join(' ')};--brand-fg:${fg.join(' ')};--brand-soft:${soft.join(' ')};--accent:${a.join(' ')};--ink:17 24 39;--muted:107 114 128;--line:229 231 235;--paper:245 246 248;--card:255 255 255;--radius:${radius};}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: number[]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
