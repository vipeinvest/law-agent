import { getDb } from '@/db/client';
import { clientIp } from '@/lib/auth';
import { handler, json } from '@/lib/api';
import { aiEnabled, resolveToken, saveStep, submitQuestionnaire } from '@/lib/onboarding';
import { orgTheme } from '@/lib/org';

export const dynamic = 'force-dynamic';

export const GET = handler(async (_req, { params }) => {
  const db = await getDb();
  const ctx = await resolveToken(db, params.token);
  return json({
    status: ctx.onboarding.status,
    expiresAt: ctx.onboarding.expires_at,
    org: { name: ctx.org.name, appName: (ctx.org.theme as { appName?: string })?.appName || ctx.org.name, theme: orgTheme(ctx.org), privacyUrl: '/datenschutz' },
    user: { name: ctx.user.name, email: ctx.user.email, employment: ctx.user.employment },
    data: ctx.profile?.data ?? {},
    completeness: ctx.profile?.completeness ?? 0,
    validation: ctx.profile?.validation ?? [],
    files: ctx.files.map((f) => ({ id: f.id, kind: f.kind, filename: f.filename, mime: f.mime, size: f.size_bytes, createdAt: f.created_at })),
    ai: aiEnabled(),
  });
});

export const POST = handler(async (req, { params }) => {
  const db = await getDb();
  const ctx = await resolveToken(db, params.token);
  const body = (await req.json().catch(() => ({}))) as { data?: Record<string, unknown> };
  const row = await saveStep(db, ctx, (body.data ?? {}) as never, clientIp());
  return json({ ok: true, completeness: row.completeness, validation: row.validation });
});

export const PUT = handler(async (req, { params }) => {
  const db = await getDb();
  const ctx = await resolveToken(db, params.token);
  const body = (await req.json().catch(() => ({}))) as { consents?: unknown };
  const res = await submitQuestionnaire(db, ctx, body.consents ?? {}, clientIp());
  return json({ ok: true, issues: res.issues });
});
