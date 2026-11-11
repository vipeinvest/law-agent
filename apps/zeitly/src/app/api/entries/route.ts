import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { fail, handler, json, parseBody, unauthorized } from '@/lib/api';
import { createEntry, entrySchema, resolveTargetUser } from '@/lib/entries';
import { listEntries } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const url = new URL(req.url);
  const q = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), userId: z.string().uuid().optional() }).safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return fail(400, 'from/to erforderlich (YYYY-MM-DD).');
  const userId = resolveTargetUser(s, q.data.userId);
  const db = await getDb();
  return json({ entries: await listEntries(db, s.org.id, userId, q.data.from, q.data.to) });
});

export const POST = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const body = await parseBody(req, entrySchema);
  const db = await getDb();
  const row = await createEntry(db, s, { id: s.user.id, email: s.user.email, ip: clientIp() }, body, s.org.time_zone);
  return json({ entry: row }, { status: 201 });
});
