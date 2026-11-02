import type { Db } from './client';
import { MIGRATIONS } from './migrations';

export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`create table if not exists zt_migrations (name text primary key, applied_at timestamptz not null default now()); alter table zt_migrations enable row level security;`);
  const { rows } = await db.query<{ name: string }>(`select name from zt_migrations`);
  const done = new Set(rows.map((r) => r.name));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    await db.tx(async (c) => {
      await c.exec(m.sql);
      await c.query(`insert into zt_migrations (name) values ($1)`, [m.name]);
    });
    applied.push(m.name);
  }
  return applied;
}
