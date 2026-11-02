/**
 * Database access – one tiny interface, two drivers:
 *  - Postgres via `pg` (production: Supabase Transaction Pooler)
 *  - PGlite (in-process WASM Postgres) for tests, local dev and the public demo
 */
import 'server-only';

export interface QueryResult<T> {
  rows: T[];
}
export interface DbClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Run a multi-statement SQL script (no parameters). */
  exec(text: string): Promise<void>;
}
export interface Db extends DbClient {
  tx<T>(fn: (c: DbClient) => Promise<T>): Promise<T>;
  kind: 'pg' | 'pglite';
  close(): Promise<void>;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  return value;
}
function normalizeRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k] = normalize(v);
    return out as T;
  });
}

async function createPg(url: string): Promise<Db> {
  const pg = await import('pg');
  const { Pool, types } = pg.default ?? pg;
  types.setTypeParser(1082, (v: string) => v); // DATE → 'YYYY-MM-DD'
  types.setTypeParser(20, (v: string) => Number(v)); // int8
  const ssl = /supabase\.co|supabase\.com|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX ?? 8), ssl, statement_timeout: 20000, idleTimeoutMillis: 30000 });
  pool.on('error', (err: Error) => console.error('[db] pool error', err.message));
  const wrap = (q: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>): DbClient => ({
    async query<T>(text: string, params?: unknown[]) {
      const res = await q(text, params);
      return { rows: normalizeRows<T>(res.rows) };
    },
    async exec(text: string) {
      await q(text);
    },
  });
  return {
    kind: 'pg',
    ...wrap((t, p) => pool.query(t, p)),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(wrap((t, p) => client.query(t, p)));
        await client.query('commit');
        return result;
      } catch (e) {
        await client.query('rollback').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  } as Db;
}

async function createPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const parsers = { 1082: (v: string) => v } as Record<number, (v: string) => unknown>;
  const db = dataDir ? new PGlite(dataDir, { parsers }) : new PGlite({ parsers });
  await db.waitReady;
  const wrap = (q: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>, ex: (text: string) => Promise<unknown>): DbClient => ({
    async query<T>(text: string, params?: unknown[]) {
      const res = await q(text, params);
      return { rows: normalizeRows<T>(res.rows) };
    },
    async exec(text: string) {
      await ex(text);
    },
  });
  return {
    kind: 'pglite',
    ...wrap((t, p) => db.query(t, p as unknown[]), (t) => db.exec(t)),
    async tx(fn) {
      return db.transaction(async (t) => fn(wrap((text, params) => t.query(text, params as unknown[]), (text) => t.exec(text))));
    },
    async close() {
      await db.close();
    },
  } as Db;
}

export async function createDb(opts: { kind: 'pg'; url: string } | { kind: 'pglite'; dataDir?: string }): Promise<Db> {
  return opts.kind === 'pg' ? createPg(opts.url) : createPglite(opts.dataDir);
}

type Global = typeof globalThis & { __zeitlyDb?: Promise<Db> };

/** Process-wide singleton (survives Next.js HMR). Runs migrations + optional demo seed on first use. */
export function getDb(): Promise<Db> {
  const g = globalThis as Global;
  if (!g.__zeitlyDb) {
    g.__zeitlyDb = (async () => {
      const kind = (process.env.ZEITLY_DB ?? (process.env.DATABASE_URL ? 'postgres' : 'pglite')).toLowerCase();
      let db: Db;
      if (kind === 'pglite') {
        db = await createPglite(process.env.ZEITLY_PGLITE_DIR || undefined);
      } else {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL is not set');
        db = await createPg(url);
      }
      const { migrate } = await import('./migrate');
      await migrate(db);
      import('@/lib/maintenance').then(({ runHousekeeping }) => runHousekeeping(db)).catch((e) => console.warn('[housekeeping] skipped', e));
      if (process.env.ZEITLY_DEMO === '1') {
        const { seedDemo } = await import('./seed-demo');
        await seedDemo(db);
      } else if (process.env.ZEITLY_SEED === 'production') {
        const { seedProduction } = await import('./seed-production');
        await seedProduction(db, { send: process.env.ZEITLY_SEED_SEND !== '0' });
      } else if (process.env.BOOTSTRAP_OWNER_EMAIL && process.env.BOOTSTRAP_ORG_SLUG) {
        const { bootstrap } = await import('./bootstrap');
        await bootstrap(db);
      }
      return db;
    })();
    g.__zeitlyDb.catch((e) => {
      console.error('[db] init failed', e);
      g.__zeitlyDb = undefined;
    });
  }
  return g.__zeitlyDb;
}
