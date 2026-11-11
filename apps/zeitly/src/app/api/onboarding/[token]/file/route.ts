import { getDb } from '@/db/client';
import { clientIp } from '@/lib/auth';
import { fail, handler, json } from '@/lib/api';
import { resolveToken, uploadDocument } from '@/lib/onboarding';
import { softDeleteFile } from '@/lib/repo-v2';
import { audit } from '@/lib/audit';
import type { DocKind } from '@/domain/onboarding';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = handler(async (req, { params }) => {
  const db = await getDb();
  const ctx = await resolveToken(db, params.token);
  const form = await req.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') || 'other') as DocKind;
  if (!(file instanceof File)) return fail(400, 'Datei fehlt.');
  const content = new Uint8Array(await file.arrayBuffer());
  const res = await uploadDocument(db, ctx, kind, file.name || `${kind}.jpg`, file.type || 'image/jpeg', content, clientIp());
  return json({ file: { id: res.file.id, kind: res.file.kind, filename: res.file.filename, mime: res.file.mime, size: res.file.size_bytes, createdAt: res.file.created_at }, extracted: res.extracted, suggestions: res.suggestions }, { status: 201 });
});

export const DELETE = handler(async (req, { params }) => {
  const db = await getDb();
  const ctx = await resolveToken(db, params.token);
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !ctx.files.some((f) => f.id === id)) return fail(404, 'Datei nicht gefunden.');
  if (ctx.onboarding.status === 'submitted' || ctx.onboarding.status === 'reviewed') return fail(409, 'Bereits abgesendet.');
  await softDeleteFile(db, ctx.org.id, id);
  await audit(db, { id: ctx.user.id, email: ctx.user.email, ip: clientIp() }, ctx.org.id, 'onboarding.file_delete', 'file', id, null, null);
  return json({ ok: true });
});
