import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, json, parseBody, unauthorized } from '@/lib/api';
import { entrySchema, patchEntry, removeEntry } from '@/lib/entries';

export const dynamic = 'force-dynamic';

export const PATCH = handler(async (req, { params }) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const body = await parseBody(req, entrySchema.partial());
  const db = await getDb();
  const row = await patchEntry(db, s, { id: s.user.id, email: s.user.email, ip: clientIp() }, params.id, body, s.org.time_zone);
  return json({ entry: row });
});

export const DELETE = handler(async (_req, { params }) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const db = await getDb();
  await removeEntry(db, s, { id: s.user.id, email: s.user.email, ip: clientIp() }, params.id);
  return json({ ok: true });
});
