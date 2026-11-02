import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession, clientIp } from '@/lib/auth';
import { handler, json, parseBody, unauthorized } from '@/lib/api';
import { API_SCOPES, createApiKey, revokeApiKey } from '@/lib/apikeys';
import { listApiKeys } from '@/lib/repo-v2';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const s = await apiSession('admin');
  if (!s) return unauthorized();
  const db = await getDb();
  return json({ keys: await listApiKeys(db, s.org.id), scopes: API_SCOPES });
});

export const POST = handler(async (req) => {
  const s = await apiSession('owner');
  if (!s) return unauthorized();
  const b = await parseBody(req, z.object({ action: z.enum(['create', 'revoke']), name: z.string().min(1).max(80).optional(), scopes: z.array(z.enum(API_SCOPES)).min(1).optional(), id: z.string().uuid().optional() }));
  const db = await getDb();
  const actor = { id: s.user.id, email: s.user.email, ip: clientIp() };
  if (b.action === 'create') {
    const r = await createApiKey(db, s.org.id, b.name || 'Lohnverrechnung', b.scopes || ['read:payroll'], actor);
    return json({ key: r.key, row: r.row }, { status: 201 });
  }
  if (!b.id) return json({ error: 'id fehlt' }, { status: 400 });
  await revokeApiKey(db, s.org.id, b.id, actor);
  return json({ ok: true });
});
