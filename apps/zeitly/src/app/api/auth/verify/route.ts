import { z } from 'zod';
import { cookies, headers } from 'next/headers';
import { clientIp, hasRole, sessionCookieOptions, verifyLoginCode } from '@/lib/auth';
import { fail, handler, json, parseBody } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  const { email, code, org } = await parseBody(req, z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/), org: z.string().nullable().optional() }));
  const res = await verifyLoginCode(email, code, clientIp(), headers().get('user-agent'), org ?? null);
  if ('error' in res) return fail(401, res.error);
  const { name, options } = sessionCookieOptions();
  cookies().set(name, res.token, options);
  const redirect = hasRole(res.user, 'admin') ? '/admin' : '/app';
  return json({ ok: true, redirect });
});
