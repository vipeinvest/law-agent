import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, json, unauthorized } from '@/lib/api';
import { retentionPreview, runRetention } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const db = await getDb();
  return json(await retentionPreview(db, s.org.id));
});

export const POST = handler(async () => {
  const s = await apiSession('owner');
  if (!s) return unauthorized();
  const db = await getDb();
  return json(await runRetention(db, s.org.id, { id: s.user.id, email: s.user.email, ip: clientIp() }));
});
