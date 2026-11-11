import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, json, parseBody, unauthorized } from '@/lib/api';
import { checkWeek, copyWeek, deleteShift, publishWeek, shiftSchema, upsertShift } from '@/lib/roster';

export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('upsert'), shift: shiftSchema }),
  z.object({ action: z.literal('delete'), id: z.string().uuid() }),
  z.object({ action: z.literal('copy'), fromMonday: z.string(), toMonday: z.string(), userIds: z.array(z.string().uuid()).optional() }),
  z.object({ action: z.literal('check'), monday: z.string() }),
  z.object({ action: z.literal('publish'), monday: z.string(), force: z.boolean().default(false), notify: z.boolean().default(true) }),
  z.object({ action: z.literal('template'), name: z.string().min(1).max(40), start: z.string(), end: z.string(), breakMinutes: z.number().int().min(0).max(600), location: z.enum(['office', 'remote', 'field']), color: z.string().nullable().optional() }),
  z.object({ action: z.literal('template_delete'), id: z.string().uuid() }),
]);

export const POST = handler(async (req) => {
  const s = await apiSession('manager');
  if (!s) return unauthorized();
  const b = await parseBody(req, actionSchema);
  const db = await getDb();
  const actor = { id: s.user.id, email: s.user.email, ip: clientIp() };
  switch (b.action) {
    case 'upsert':
      return json({ shift: await upsertShift(db, s, actor, b.shift) });
    case 'delete':
      await deleteShift(db, s, actor, b.id);
      return json({ ok: true });
    case 'copy':
      return json({ copied: await copyWeek(db, s, actor, b.fromMonday, b.toMonday, b.userIds) });
    case 'check':
      return json({ checks: await checkWeek(db, s.org, b.monday) });
    case 'publish':
      return json(await publishWeek(db, s, actor, b.monday, { force: b.force, notify: b.notify }));
    case 'template': {
      const { rows } = await db.query(`insert into zt_shift_templates (org_id, name, start_time, end_time, break_minutes, location, color) values ($1,$2,$3,$4,$5,$6,$7) returning *`, [s.org.id, b.name, b.start, b.end, b.breakMinutes, b.location, b.color ?? null]);
      return json({ template: rows[0] });
    }
    case 'template_delete':
      await db.query(`delete from zt_shift_templates where org_id = $1 and id = $2`, [s.org.id, b.id]);
      return json({ ok: true });
  }
});
