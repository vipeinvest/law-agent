import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/db/client';
import { migrate } from '@/db/migrate';
import { seedDemo } from '@/db/seed-demo';
import { evaluatePeriod } from '@/domain/rules';
import { DEFAULT_RULES, DEFAULT_EMPLOYMENT } from '@/domain/types';
import { toISODate } from '@/domain/time';

let db: Db;
beforeAll(async () => {
  db = await createDb({ kind: 'pglite' });
  const applied = await migrate(db);
  expect(applied).toContain('0001_init');
  await seedDemo(db);
});
afterAll(async () => {
  await db.close();
});

describe('schema + seed', () => {
  it('migrations are idempotent', async () => {
    const again = await migrate(db);
    expect(again).toEqual([]);
  });
  it('seeded two organisations with users, projects, entries', async () => {
    const orgs = await db.query<{ slug: string }>(`select slug from zt_orgs order by slug`);
    expect(orgs.rows.map((o) => o.slug)).toEqual(['malelu', 'steinerfood']);
    const users = await db.query<{ n: number }>(`select count(*)::int as n from zt_users`);
    expect(users.rows[0].n).toBe(9);
    const entries = await db.query<{ n: number }>(`select count(*)::int as n from zt_time_entries`);
    expect(entries.rows[0].n).toBeGreaterThan(100);
    const d = await db.query<{ date: string }>(`select date from zt_time_entries limit 1`);
    expect(typeof d.rows[0].date).toBe('string');
    expect(d.rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('enforces constraints', async () => {
    const org = (await db.query<{ id: string }>(`select id from zt_orgs where slug='steinerfood'`)).rows[0].id;
    const user = (await db.query<{ id: string }>(`select id from zt_users where email='lukas.brandstaetter@steinerfood.com'`)).rows[0].id;
    await expect(db.query(`insert into zt_time_entries (org_id,user_id,date,start_at,end_at) values ($1,$2,'2026-11-02','2026-11-02T10:00:00Z','2026-11-02T09:00:00Z')`, [org, user])).rejects.toThrow();
    await expect(db.query(`insert into zt_absences (org_id,user_id,date_from,date_to,type) values ($1,$2,'2026-11-05','2026-11-02','vacation')`, [org, user])).rejects.toThrow();
    await expect(db.query(`insert into zt_users (org_id,email,name,role) values ($1,'x@y.z','X','superuser')`, [org])).rejects.toThrow();
  });
  it('RLS is enabled on all zt_ tables', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(`select relname, relrowsecurity from pg_class where relname like 'zt\\_%' and relkind = 'r'`);
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });
  it('transactions roll back on error', async () => {
    const before = (await db.query<{ n: number }>(`select count(*)::int as n from zt_projects`)).rows[0].n;
    await expect(
      db.tx(async (c) => {
        const org = (await c.query<{ id: string }>(`select id from zt_orgs where slug='malelu'`)).rows[0].id;
        await c.query(`insert into zt_projects (org_id, code, name) values ($1,'TMP','tmp')`, [org]);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const after = (await db.query<{ n: number }>(`select count(*)::int as n from zt_projects`)).rows[0].n;
    expect(after).toBe(before);
  });
  it('rules engine finds the seeded findings for the previous month', async () => {
    const today = toISODate(new Date(), 'Europe/Vienna');
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
    const tobias = (await db.query<{ id: string }>(`select id from zt_users where email='tobias.kern@steinerfood.com'`)).rows[0].id;
    const { rows } = await db.query<{ id: string; user_id: string; date: string; start_at: string | null; end_at: string | null; break_minutes: number; duration_minutes: number | null; type: 'work'; location: 'office'; project_id: string | null; note: string | null; source: 'manual'; status: 'open' }>(`select * from zt_time_entries where user_id = $1`, [tobias]);
    const r = evaluatePeriod({
      userId: tobias,
      year: py,
      month: pm,
      rules: DEFAULT_RULES,
      employment: DEFAULT_EMPLOYMENT,
      entries: rows.map((e) => ({ id: e.id, userId: e.user_id, date: e.date, startAt: e.start_at, endAt: e.end_at, breakMinutes: e.break_minutes, durationMinutes: e.duration_minutes, type: e.type, location: e.location, projectId: e.project_id, note: e.note, source: e.source, status: e.status })),
      absences: [],
      balanceStartMinutes: 0,
    });
    const codes = r.violations.map((x) => x.code);
    expect(codes).toContain('DAILY_MAX_EXCEEDED');
    expect(codes).toContain('REST_TOO_SHORT');
  });
});
