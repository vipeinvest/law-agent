/**
 * Demo/E2E seed – deterministic, relative to today, idempotent (skips when the demo org exists).
 * Organisation 1: STEINERfood GmbH (Pilotkunde), Organisation 2: MALELU AI.
 */
import type { Db, DbClient } from './client';
import { addDays, isoWeekday, localDateTimeToInstant, monthRange, toISODate } from '@/domain/time';

const TZ = 'Europe/Vienna';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

interface SeedUser {
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'payroll' | 'employee';
  personnelNo: string;
  employment: Record<string, unknown>;
  profile: 'office' | 'remote' | 'field' | 'parttime' | 'none';
}

const STEINERFOOD_USERS: SeedUser[] = [
  { email: 'inge.steiner@steinerfood.com', name: 'Inge Steiner', role: 'owner', personnelNo: 'SF-001', employment: { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'duration_only', gleitzeit: true, vacationDaysPerYear: 25 }, profile: 'none' },
  { email: 'm.behr@steinerfood.com', name: 'Manuela Behr', role: 'admin', personnelNo: 'SF-002', employment: { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: true, vacationDaysPerYear: 25 }, profile: 'remote' },
  { email: 'lukas.brandstaetter@steinerfood.com', name: 'Lukas Brandstätter', role: 'employee', personnelNo: 'SF-003', employment: { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: false, vacationDaysPerYear: 25 }, profile: 'remote' },
  { email: 'sarah.mayer@steinerfood.com', name: 'Sarah Mayer', role: 'employee', personnelNo: 'SF-004', employment: { weeklyMinutes: 1200, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: false, vacationDaysPerYear: 25 }, profile: 'parttime' },
  { email: 'tobias.kern@steinerfood.com', name: 'Tobias Kern', role: 'employee', personnelNo: 'SF-005', employment: { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: false, vacationDaysPerYear: 25 }, profile: 'field' },
  { email: 'nina.hofer@steinerfood.com', name: 'Nina Hofer', role: 'manager', personnelNo: 'SF-006', employment: { weeklyMinutes: 2310, workDays: [1, 2, 3, 4, 5], recordMode: 'full', gleitzeit: true, vacationDaysPerYear: 25 }, profile: 'office' },
  { email: 'lohn@steuerberatung-demo.at', name: 'Lohnverrechnung (Steuerberatung)', role: 'payroll', personnelNo: '', employment: {}, profile: 'none' },
];

const STEINERFOOD_PROJECTS = [
  ['VERTRIEB', 'Vertrieb LEH & Fachhandel', 'Handelspartner', 'KST-100', '#1f5f5b', false],
  ['SHOP', 'Online-Shop steiners.shop', 'Endkunden', 'KST-200', '#e07a2f', false],
  ['PRODUKT', 'Produktentwicklung', null, 'KST-300', '#5b6abf', false],
  ['MESSE', 'Messen & Events', null, 'KST-110', '#b23a48', false],
  ['VERWALTUNG', 'Verwaltung & Büro', null, 'KST-900', '#6b7280', false],
] as const;

export async function seedDemo(db: Db): Promise<void> {
  const exists = await db.query<{ id: string }>(`select id from zt_orgs where slug = 'steinerfood'`);
  if (exists.rows[0]) return;
  await db.tx(async (c) => {
    const org = await insertOrg(c, {
      slug: 'steinerfood',
      name: 'STEINERfood GmbH',
      legalName: 'STEINERfood GmbH',
      address: 'Neustift 6, 2224 Sulz im Weinviertel, Österreich',
      uid: 'ATU75165606',
      contactEmail: 'office@steinerfood.com',
      payrollEmail: 'lohn@steuerberatung-demo.at',
      settings: { normalWeeklyMinutes: 2400, fullTimeWeeklyMinutes: 2400, extraHolidays: { '12-24': 0.5, '12-31': 0.5 } },
      theme: { primary: '#2f6b4f', accent: '#e8a33d', logoText: "STEINER's", appName: 'STEINERfood Zeit', radius: 'round' },
    });
    const users: Record<string, string> = {};
    for (const u of STEINERFOOD_USERS) users[u.email] = await insertUser(c, org, u);
    await c.query(`update zt_users set manager_id = $1 where org_id = $2 and role = 'employee'`, [users['nina.hofer@steinerfood.com'], org]);
    const projects: Record<string, string> = {};
    for (const [code, name, customer, cc, color, billable] of STEINERFOOD_PROJECTS) {
      const { rows } = await c.query<{ id: string }>(`insert into zt_projects (org_id, code, name, customer, cost_center, color, billable) values ($1,$2,$3,$4,$5,$6,$7) returning id`, [org, code, name, customer, cc, color, billable]);
      projects[code] = rows[0].id;
    }
    const today = toISODate(new Date(), TZ);
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
    const [ppy, ppm] = pm === 1 ? [py - 1, 12] : [py, pm - 1];
    const months: Array<[number, number]> = [
      [ppy, ppm],
      [py, pm],
      [y, m],
    ];
    const projectIds = Object.values(projects);
    let seed = 42;
    for (const u of STEINERFOOD_USERS) {
      if (u.profile === 'none') continue;
      const rand = rng(seed++);
      for (const [yy, mm] of months) {
        const { from, to } = monthRange(yy, mm);
        let d = from;
        while (d <= to && d < today) {
          const wd = isoWeekday(d);
          if (wd <= 5) {
            const skip = rand() < 0.04;
            if (!skip) await seedDay(c, org, users[u.email], d, u.profile, rand, projectIds, projects);
          } else if (u.profile === 'field' && wd === 6 && rand() < 0.1) {
            await insertEntry(c, org, users[u.email], d, '09:00', '13:00', 0, 'work', 'field', projects['MESSE'], 'Messe Wochenende');
          }
          d = addDays(d, 1);
        }
      }
    }
    // deliberate findings for the demo (previous month)
    const lukas = users['lukas.brandstaetter@steinerfood.com'];
    const tobias = users['tobias.kern@steinerfood.com'];
    const sarah = users['sarah.mayer@steinerfood.com'];
    const { from: pf } = monthRange(py, pm);
    const firstTue = nextWeekday(pf, 2);
    await c.query(`delete from zt_time_entries where org_id = $1 and user_id = $2 and date = $3`, [org, tobias, firstTue]);
    await insertEntry(c, org, tobias, firstTue, '06:00', '19:15', 30, 'work', 'field', projects['MESSE'], 'Messeaufbau Wien'); // 12:45 → > 12 h
    const wed = addDays(firstTue, 1);
    await c.query(`delete from zt_time_entries where org_id = $1 and user_id = $2 and date = $3`, [org, tobias, wed]);
    await insertEntry(c, org, tobias, wed, '05:30', '13:00', 30, 'work', 'field', projects['MESSE'], 'Messe Tag 2'); // rest < 11 h
    const thu = addDays(firstTue, 2);
    await c.query(`delete from zt_time_entries where org_id = $1 and user_id = $2 and date = $3`, [org, lukas, thu]);
    await insertEntry(c, org, lukas, thu, '08:00', '15:30', 0, 'work', 'remote', projects['SHOP'], 'Release Shop-Update'); // missing break
    // absences
    const { from: cf } = monthRange(y, m);
    await insertAbsence(c, org, sarah, addDays(nextWeekday(cf, 1), 7), addDays(nextWeekday(cf, 1), 9), 'vacation', 'approved', users['nina.hofer@steinerfood.com']);
    await insertAbsence(c, org, lukas, nextWeekday(addDays(pf, 10), 1), nextWeekday(addDays(pf, 10), 1), 'sick', 'approved', users['nina.hofer@steinerfood.com']);
    await insertAbsence(c, org, tobias, addDays(today, 14), addDays(today, 18), 'vacation', 'requested', null);
    await insertAbsence(c, org, lukas, addDays(today, 3), addDays(today, 3), 'time_comp', 'requested', null);
    // remove seeded entries on absence days
    await c.query(`delete from zt_time_entries e using zt_absences a where e.org_id = $1 and a.org_id = $1 and a.user_id = e.user_id and a.status = 'approved' and e.date between a.date_from and a.date_to`, [org]);
    // a closed period for the month before last (balance chain)
    for (const email of ['lukas.brandstaetter@steinerfood.com', 'sarah.mayer@steinerfood.com']) {
      await c.query(`insert into zt_periods (org_id, user_id, year, month, status, submitted_at, approved_by, approved_at, balance_start, balance_end, summary) values ($1,$2,$3,$4,'approved', now() - interval '35 days', $5, now() - interval '33 days', 0, $6, '{}')`, [org, users[email], ppy, ppm, users['nina.hofer@steinerfood.com'], email.startsWith('lukas') ? 185 : -40]);
    }
    // roster: templates + published plan for this week, draft for next week (Sarah: plan-based target)
    await c.query(`insert into zt_shift_templates (org_id, name, start_time, end_time, break_minutes, location, color) values ($1,'Büro früh','07:30','16:00',30,'office','#2f6b4f'), ($1,'Büro spät','09:30','18:00',30,'office','#5b6abf'), ($1,'Remote','08:00','16:30',30,'remote','#1f5f5b'), ($1,'Außendienst','06:30','15:30',30,'field','#e07a2f'), ($1,'Teilzeit vormittag','08:00','12:00',0,'office','#e8a33d')`, [org]);
    const monday = addDays(today, -(isoWeekday(today) - 1));
    const rosterUsers: Array<[string, string, string, number, string, number[]]> = [
      ['sarah.mayer@steinerfood.com', '08:00', '12:00', 0, 'office', [1, 2, 3, 4, 5]],
      ['tobias.kern@steinerfood.com', '06:30', '15:30', 30, 'field', [1, 2, 3, 4, 5]],
      ['lukas.brandstaetter@steinerfood.com', '08:00', '16:30', 30, 'remote', [1, 2, 3, 4, 5]],
      ['nina.hofer@steinerfood.com', '07:30', '16:00', 30, 'office', [1, 2, 3, 4, 5]],
    ];
    for (const week of [0, 7]) {
      for (const [email, st, en, br, loc, wd] of rosterUsers) {
        for (const d of wd) {
          const date = addDays(monday, week + d - 1);
          await c.query(`insert into zt_shifts (org_id, user_id, date, start_time, end_time, break_minutes, location, status, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [org, users[email], date, st, en, br, loc, week === 0 ? 'published' : 'draft', users['nina.hofer@steinerfood.com']]);
        }
      }
    }
    await c.query(`update zt_users set employment = employment || '{"targetMode":"plan","autoAdoptPlan":true}'::jsonb where id = $1`, [users['sarah.mayer@steinerfood.com']]);
    // running timer for Manuela
    await c.query(`insert into zt_timers (user_id, org_id, started_at, type, location, project_id, note) values ($1,$2, now() - interval '2 hours 17 minutes', 'work', 'remote', $3, 'Angebote LEH Q1')`, [users['m.behr@steinerfood.com'], org, projects['VERTRIEB']]);

    // Organisation 2: MALELU
    const malelu = await insertOrg(c, {
      slug: 'malelu',
      name: 'MALELU AI',
      legalName: 'MALELU AI – Peter Vitzthum',
      address: 'Salzburg, Österreich',
      uid: null,
      contactEmail: 'office@malelu.io',
      payrollEmail: 'office@malelu.io',
      settings: { normalWeeklyMinutes: 2400 },
      theme: { primary: '#0f172a', accent: '#10b981', logoText: 'MALELU', appName: 'MALELU Zeit', radius: 'soft' },
    });
    await insertUser(c, malelu, { email: 'office@malelu.io', name: 'Peter Vitzthum', role: 'owner', personnelNo: 'ML-001', employment: { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'duration_only', gleitzeit: true }, profile: 'none' });
    await insertUser(c, malelu, { email: 'vipeinvestag@gmail.com', name: 'Peter Vitzthum (privat)', role: 'admin', personnelNo: 'ML-002', employment: { weeklyMinutes: 2400, workDays: [1, 2, 3, 4, 5], recordMode: 'duration_only', gleitzeit: true }, profile: 'none' });
    await c.query(`insert into zt_projects (org_id, code, name, cost_center, color, billable) values ($1,'KOMPAGNON','KOMPΛGNON','KST-10','#0f172a',true), ($1,'CLAIMLY','Claimly','KST-20','#10b981',true), ($1,'ZEITLY','Zeitly','KST-30','#1f5f5b',false), ($1,'INTERN','Intern / Admin','KST-90','#6b7280',false)`, [malelu]);
  });
  console.info('[seed] demo data created');
}

async function insertOrg(c: DbClient, o: { slug: string; name: string; legalName: string; address: string; uid: string | null; contactEmail: string; payrollEmail: string; settings: Record<string, unknown>; theme: Record<string, unknown> }): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into zt_orgs (slug, name, legal_name, address, uid_number, contact_email, payroll_email, settings, theme) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [o.slug, o.name, o.legalName, o.address, o.uid, o.contactEmail, o.payrollEmail, JSON.stringify(o.settings), JSON.stringify(o.theme)],
  );
  return rows[0].id;
}

function seedStartDate(): string {
  const today = toISODate(new Date(), TZ);
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7)) - 2;
  if (m <= 0) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

async function insertUser(c: DbClient, org: string, u: SeedUser): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `insert into zt_users (org_id, email, name, role, personnel_no, employment, invited_at, consent_at, last_login_at) values ($1,$2,$3,$4,$5,$6, now() - interval '90 days', now() - interval '89 days', now() - interval '1 day') returning id`,
    [org, u.email, u.name, u.role, u.personnelNo || null, JSON.stringify({ ...u.employment, startDate: seedStartDate(), openingBalanceMinutes: 0, teleworkAgreement: u.profile === 'remote' || u.profile === 'parttime' })],
  );
  return rows[0].id;
}

async function insertEntry(c: DbClient, org: string, user: string, date: string, start: string, end: string, breakMin: number, type: string, location: string, project: string | null, note: string | null): Promise<void> {
  await c.query(
    `insert into zt_time_entries (org_id, user_id, date, start_at, end_at, break_minutes, type, location, project_id, note, source, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'timer',$2)`,
    [org, user, date, localDateTimeToInstant(date, start, TZ), localDateTimeToInstant(date, end, TZ), breakMin, type, location, project, note],
  );
}

async function insertAbsence(c: DbClient, org: string, user: string, from: string, to: string, type: string, status: string, decidedBy: string | null): Promise<void> {
  await c.query(`insert into zt_absences (org_id, user_id, date_from, date_to, type, status, created_by, decided_by, decided_at) values ($1,$2,$3,$4,$5,$6,$2,$7, case when $6 = 'approved' then now() else null end)`, [org, user, from, to, type, status, decidedBy]);
}

function nextWeekday(from: string, wd: number): string {
  let d = from;
  while (isoWeekday(d) !== wd) d = addDays(d, 1);
  return d;
}

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function seedDay(c: DbClient, org: string, user: string, date: string, profile: SeedUser['profile'], rand: () => number, projectIds: string[], projects: Record<string, string>): Promise<void> {
  const pick = () => projectIds[Math.floor(rand() * projectIds.length)];
  if (profile === 'parttime') {
    const start = 8 * 60 + Math.floor(rand() * 4) * 15;
    const len = 4 * 60 + (rand() < 0.3 ? 60 : 0);
    await insertEntry(c, org, user, date, hm(start), hm(start + len), 0, 'work', rand() < 0.7 ? 'remote' : 'office', projects['SHOP'], null);
    return;
  }
  const location = profile === 'office' ? (rand() < 0.8 ? 'office' : 'remote') : profile === 'remote' ? (rand() < 0.85 ? 'remote' : 'office') : rand() < 0.7 ? 'field' : 'office';
  const start = 7 * 60 + 30 + Math.floor(rand() * 6) * 15;
  const morning = 4 * 60 + Math.floor(rand() * 4) * 15;
  const breakMin = 30 + (rand() < 0.3 ? 15 : 0);
  const afternoon = 3 * 60 + 30 + Math.floor(rand() * 7) * 15; // 3:30–5:00
  const split = rand() < 0.5;
  if (split) {
    await insertEntry(c, org, user, date, hm(start), hm(start + morning), 0, 'work', location, pick(), null);
    await insertEntry(c, org, user, date, hm(start + morning + breakMin), hm(start + morning + breakMin + afternoon), 0, 'work', location, pick(), null);
  } else {
    await insertEntry(c, org, user, date, hm(start), hm(start + morning + breakMin + afternoon), breakMin, 'work', location, pick(), null);
  }
  if (profile === 'field' && rand() < 0.4) {
    await insertEntry(c, org, user, date, hm(start - 60), hm(start), 0, 'travel', 'field', projects['VERTRIEB'], 'Anfahrt Kunde');
  }
}
