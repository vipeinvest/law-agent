import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, json, parseBody, unauthorized } from '@/lib/api';
import { approvePeriod, markExported, reopenPeriod, submitPeriod } from '@/lib/periods';

export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['submit', 'approve', 'reopen', 'export']),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  userId: z.string().uuid().optional(),
  userIds: z.array(z.string().uuid()).optional(),
  note: z.string().max(1000).nullable().optional(),
  reason: z.string().max(500).optional(),
});

export const POST = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const b = await parseBody(req, schema);
  const db = await getDb();
  const actor = { id: s.user.id, email: s.user.email, ip: clientIp() };
  switch (b.action) {
    case 'submit':
      return json({ period: await submitPeriod(db, s, actor, b.year, b.month, b.note ?? null, b.userId) });
    case 'approve':
      return json({ period: await approvePeriod(db, s, actor, b.userId ?? s.user.id, b.year, b.month) });
    case 'reopen':
      return json({ period: await reopenPeriod(db, s, actor, b.userId ?? s.user.id, b.year, b.month, b.reason ?? '') });
    case 'export':
      return json({ count: await markExported(db, s, actor, b.year, b.month, b.userIds ?? []) });
  }
});
