/**
 * Production seed (idempotent): the two real tenants for the pilot.
 *   1. MALELU AI  – Peter Vitzthum (owner, office@malelu.io) + vipeinvestag@gmail.com (admin)
 *   2. STEINERfood GmbH – Geschäftsführung Inge Monika Steiner & Matthias Steiner (owner, inactive placeholder
 *      addresses until confirmed), Manuela Behr (admin, first employee) – receives the onboarding questionnaire
 *      and the login invitation automatically on first start (ZEITLY_SEED=production).
 * Re-running never overwrites existing rows and never sends a second invitation.
 */
import type { Db, DbClient } from './client';

interface SeedOrg {
  slug: string;
  name: string;
  legalName: string;
  address: string;
  uid: string | null;
  contactEmail: string;
  payrollEmail: string;
  settings: Record<string, unknown>;
  theme: Record<string, unknown>;
  projects: Array<[string, string, string | null, string, string, boolean]>;
  users: Array<{ email: string; name: string; role: 'owner' | 'admin' | 'manager' | 'payroll' | 'employee'; personnelNo: string; active: boolean; employment: Record<string, unknown>; onboarding?: boolean; invite?: boolean }>;
}

const FULL = { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: true, vacationDaysPerYear: 25, allIn: false, teleworkAgreement: true };

export const PRODUCTION_ORGS: SeedOrg[] = [
  {
    slug: 'malelu',
    name: 'MALELU AI',
    legalName: 'MALELU AI – Peter Vitzthum',
    address: 'Salzburg, Österreich',
    uid: null,
    contactEmail: 'office@malelu.io',
    payrollEmail: 'office@malelu.io',
    settings: { normalWeeklyMinutes: 2400, fullTimeWeeklyMinutes: 2400 },
    theme: { primary: '#0f172a', accent: '#10b981', logoText: 'MALELU', appName: 'MALELU Zeit', radius: 'soft' },
    projects: [
      ['KOMPAGNON', 'KOMPΛGNON', null, 'KST-10', '#0f172a', true],
      ['CLAIMLY', 'Claimly', null, 'KST-20', '#10b981', true],
      ['ZEITLY', 'Zeitly', null, 'KST-30', '#1f5f5b', false],
      ['INTERN', 'Intern / Admin', null, 'KST-90', '#6b7280', false],
    ],
    users: [
      { email: 'office@malelu.io', name: 'Peter Vitzthum', role: 'owner', personnelNo: 'ML-001', active: true, employment: { ...FULL, recordMode: 'duration_only', azgExempt: true } },
      { email: 'vipeinvestag@gmail.com', name: 'Peter Vitzthum (privat)', role: 'admin', personnelNo: 'ML-002', active: true, employment: { ...FULL, recordMode: 'duration_only', azgExempt: true } },
    ],
  },
  {
    slug: 'steinerfood',
    name: 'STEINERfood GmbH',
    legalName: 'STEINERfood GmbH',
    address: 'Neustift 6, 2224 Sulz im Weinviertel, Österreich',
    uid: 'ATU75165606',
    contactEmail: 'office@steinerfood.com',
    payrollEmail: '',
    settings: { normalWeeklyMinutes: 2400, fullTimeWeeklyMinutes: 2400, extraHolidays: { '12-24': 0.5, '12-31': 0.5 } },
    theme: { primary: '#2f6b4f', accent: '#e8a33d', logoText: "STEINER's", appName: 'STEINERfood Zeit', radius: 'round' },
    projects: [
      ['VERTRIEB', 'Vertrieb LEH & Fachhandel', 'Handelspartner', 'KST-100', '#1f5f5b', false],
      ['SHOP', 'Online-Shop', 'Endkunden', 'KST-200', '#e07a2f', false],
      ['PRODUKT', 'Produktentwicklung', null, 'KST-300', '#5b6abf', false],
      ['MESSE', 'Messen & Events', null, 'KST-110', '#b23a48', false],
      ['VERWALTUNG', 'Verwaltung & Büro', null, 'KST-900', '#6b7280', false],
    ],
    users: [
      // Geschäftsführung – Adressen sind Platzhalter (inaktiv) bis Manuela/Peter sie bestätigen; Aktivierung in Admin → Mitarbeiter.
      { email: 'inge.steiner@steinerfood.com', name: 'Inge Monika Steiner', role: 'owner', personnelNo: 'SF-001', active: false, employment: { ...FULL, recordMode: 'duration_only', azgExempt: true } },
      { email: 'matthias.steiner@steinerfood.com', name: 'Matthias Steiner', role: 'owner', personnelNo: 'SF-002', active: false, employment: { ...FULL, recordMode: 'duration_only', azgExempt: true } },
      // erste Mitarbeiterin + Admin: bekommt Fragebogen-Link und Zugangs-Einladung
      { email: 'm.behr@steinerfood.com', name: 'Manuela Behr', role: 'admin', personnelNo: 'SF-003', active: true, employment: { ...FULL }, onboarding: true, invite: true },
    ],
  },
];

export async function seedProduction(db: Db, opts: { send?: boolean } = {}): Promise<{ createdOrgs: string[]; createdUsers: string[]; invited: string[] }> {
  const createdOrgs: string[] = [];
  const createdUsers: string[] = [];
  const invited: string[] = [];
  for (const o of PRODUCTION_ORGS) {
    let orgId = (await db.query<{ id: string }>(`select id from zt_orgs where slug = $1`, [o.slug])).rows[0]?.id;
    if (!orgId) {
      orgId = (
        await db.query<{ id: string }>(`insert into zt_orgs (slug, name, legal_name, address, uid_number, contact_email, payroll_email, settings, theme) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [
          o.slug,
          o.name,
          o.legalName,
          o.address,
          o.uid,
          o.contactEmail,
          o.payrollEmail || null,
          JSON.stringify(o.settings),
          JSON.stringify(o.theme),
        ])
      ).rows[0].id;
      createdOrgs.push(o.slug);
      for (const [code, name, customer, cc, color, billable] of o.projects) {
        await db.query(`insert into zt_projects (org_id, code, name, customer, cost_center, color, billable) values ($1,$2,$3,$4,$5,$6,$7) on conflict (org_id, code) do nothing`, [orgId, code, name, customer, cc, color, billable]);
      }
    }
    for (const u of o.users) {
      const existing = (await db.query<{ id: string }>(`select id from zt_users where org_id = $1 and email = $2`, [orgId, u.email])).rows[0];
      if (existing) continue;
      const { rows } = await db.query<{ id: string }>(`insert into zt_users (org_id, email, name, role, personnel_no, employment, active, invited_at) values ($1,$2,$3,$4,$5,$6,$7, case when $8 then now() else null end) returning id`, [
        orgId,
        u.email,
        u.name,
        u.role,
        u.personnelNo,
        JSON.stringify(u.employment),
        u.active,
        !!u.invite,
      ]);
      createdUsers.push(`${o.slug}:${u.email}`);
      if (opts.send && (u.onboarding || u.invite)) {
        try {
          await inviteUser(db, orgId, rows[0].id, { onboarding: !!u.onboarding, invite: !!u.invite });
          invited.push(u.email);
        } catch (e) {
          console.warn('[seed:production] invitation failed for', u.email, e instanceof Error ? e.message : e);
        }
      }
    }
  }
  if (createdOrgs.length || createdUsers.length) console.info('[seed:production]', JSON.stringify({ createdOrgs, createdUsers, invited }));
  return { createdOrgs, createdUsers, invited };
}

async function inviteUser(db: DbClient, orgId: string, userId: string, what: { onboarding: boolean; invite: boolean }): Promise<void> {
  const [{ getOrgById }, { getUser }, { sendOnboardingInvite }, { sendLoginInvite }] = await Promise.all([import('@/lib/org'), import('@/lib/repo'), import('@/lib/onboarding'), import('@/lib/invite')]);
  const org = await getOrgById(db, orgId);
  const user = await getUser(db, orgId, userId);
  if (!org || !user) return;
  const actor = { id: null, email: 'system', ip: null };
  if (what.onboarding) await sendOnboardingInvite(db, org, user, actor, { message: 'PS: Du bist als Administratorin eingerichtet – nach dem Fragebogen kannst du im Admin-Bereich weitere Kolleg:innen anlegen; jede Person bekommt denselben Link automatisch.' });
  if (what.invite) await sendLoginInvite(db, org, user, 'Zeitly');
}
