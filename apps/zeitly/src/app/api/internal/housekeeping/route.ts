import { getDb } from '@/db/client';
import { fail, handler, json } from '@/lib/api';
import { runHousekeeping } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

/** Called daily by the cron sidecar (docker-compose) – Authorization: Bearer $CRON_SECRET. */
export const POST = handler(async (req) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!secret || auth !== `Bearer ${secret}`) return fail(401, 'Unauthorized');
  const db = await getDb();
  const result = await runHousekeeping(db);
  console.info('[housekeeping]', JSON.stringify(result));
  return json(result);
});
