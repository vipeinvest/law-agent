import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, json, parseBody, unauthorized } from '@/lib/api';
import { getTimer } from '@/lib/repo';
import { breakTimer, discardTimer, startTimer, stopTimer, timerState, updateTimer } from '@/lib/timer';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const db = await getDb();
  return json(timerState(await getTimer(db, s.user.id)));
});

const bodySchema = z.object({
  action: z.enum(['start', 'stop', 'break_start', 'break_end', 'update', 'discard']),
  at: z.string().datetime().optional(),
  type: z.enum(['work', 'travel', 'oncall']).optional(),
  location: z.enum(['office', 'remote', 'field']).optional(),
  projectId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const POST = handler(async (req) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const b = await parseBody(req, bodySchema);
  const db = await getDb();
  const actor = { id: s.user.id, email: s.user.email, ip: clientIp() };
  switch (b.action) {
    case 'start':
      return json(await startTimer(db, s, actor, { type: b.type ?? 'work', location: b.location ?? 'office', projectId: b.projectId ?? null, note: b.note ?? null, at: b.at }));
    case 'stop': {
      const res = await stopTimer(db, s, actor, b.at, b.note);
      return json({ ...timerState(null), stopped: res });
    }
    case 'break_start':
      return json(await breakTimer(db, s, actor, 'start', b.at));
    case 'break_end':
      return json(await breakTimer(db, s, actor, 'end', b.at));
    case 'update':
      return json(await updateTimer(db, s, actor, { location: b.location, projectId: b.projectId, note: b.note, type: b.type }));
    case 'discard':
      await discardTimer(db, s, actor);
      return json(timerState(null));
  }
});
