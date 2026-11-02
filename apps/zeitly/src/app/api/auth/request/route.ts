import { z } from 'zod';
import { clientIp, requestLoginCode } from '@/lib/auth';
import { handler, json, parseBody } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  const { email } = await parseBody(req, z.object({ email: z.string().email().max(200) }));
  const res = await requestLoginCode(email, clientIp());
  return json({ ok: true, demoCode: res.demoCode });
});
