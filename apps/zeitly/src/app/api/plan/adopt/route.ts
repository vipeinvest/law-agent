import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, json, parseBody, unauthorized } from '@/lib/api';
import { adoptPlan } from '@/lib/roster';

export const dynamic = 'force-dynamic';

/** Employee: "wie geplant übernehmen" for a day or a range (creates entries from published shifts). */
export const POST = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const b = await parseBody(req, z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), userId: z.string().uuid().optional() }));
  const db = await getDb();
  return json(await adoptPlan(db, s, { id: s.user.id, email: s.user.email, ip: clientIp() }, b.from, b.to ?? b.from, b.userId));
});
