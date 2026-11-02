import { getDb } from '@/db/client';
import { apiSession, hasRole } from '@/lib/auth';
import { fail, handler, unauthorized } from '@/lib/api';
import { getFileWithContent } from '@/lib/repo-v2';

export const dynamic = 'force-dynamic';

/** Serves an uploaded document to its owner or to admins (inline, no caching). */
export const GET = handler(async (_req, { params }) => {
  const s = await apiSession();
  if (!s) return unauthorized();
  const db = await getDb();
  const f = await getFileWithContent(db, s.org.id, params.id);
  if (!f) return fail(404, 'Datei nicht gefunden.');
  if (f.user_id !== s.user.id && !hasRole(s.user, 'admin')) return fail(403, 'Keine Berechtigung.');
  return new Response(Buffer.from(f.content), { headers: { 'content-type': f.mime, 'content-disposition': `inline; filename="${encodeURIComponent(f.filename)}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
});
