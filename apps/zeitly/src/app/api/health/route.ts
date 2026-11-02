import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { env, assertProdConfig } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let db: 'ok' | 'error' = 'ok';
  let dbMs = 0;
  try {
    const d = await getDb();
    await d.query('select 1');
    dbMs = Date.now() - started;
  } catch (e) {
    db = 'error';
    console.error('[health] db', e);
  }
  const problems = assertProdConfig();
  const ok = db === 'ok' && problems.length === 0;
  return NextResponse.json(
    { ok, service: 'zeitly', version: env.version, sha: env.buildSha || undefined, db, dbMs, mail: env.resendApiKey ? 'resend' : 'console', demo: env.demo, problems, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
