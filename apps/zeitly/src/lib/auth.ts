import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, type Db } from '@/db/client';
import { env } from './env';
import { hmac, randomCode, randomToken, sha256 } from './crypto';
import { escapeHtml, layout, sendMail } from './mail';
import { getOrgById, orgRules, orgTheme, userEmployment, type OrgRow, type UserRow } from './org';
import { audit } from './audit';
import type { Role } from '@/domain/types';

export const SESSION_COOKIE = 'zt_session';

export interface Session {
  user: UserRow;
  org: OrgRow;
  sessionId: string;
}

export function clientIp(): string | null {
  const h = headers();
  const xf = h.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return h.get('x-real-ip');
}

function tokenHash(token: string): string {
  return hmac(env.sessionSecret || 'dev', token);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Step 1: request a login code. Always answers success (no account enumeration). */
export async function requestLoginCode(emailRaw: string, ip: string | null): Promise<{ ok: true; demoCode?: string; accounts: number }> {
  const email = normalizeEmail(emailRaw);
  const db = await getDb();
  // rate limit: max 5 codes per 15 min per email, 20 per ip per hour
  const { rows: recent } = await db.query<{ n: number }>(`select count(*)::int as n from zt_login_codes where email = $1 and created_at > now() - interval '15 minutes'`, [email]);
  if ((recent[0]?.n ?? 0) >= 5) return { ok: true, accounts: 0 };
  if (ip) {
    const { rows: byIp } = await db.query<{ n: number }>(`select count(*)::int as n from zt_login_codes where ip = $1 and created_at > now() - interval '1 hour'`, [ip]);
    if ((byIp[0]?.n ?? 0) >= 20) return { ok: true, accounts: 0 };
  }
  const { rows: users } = await db.query<UserRow & { org_name: string; theme: OrgRow['theme'] }>(
    `select u.*, o.name as org_name, o.theme from zt_users u join zt_orgs o on o.id = u.org_id where u.email = $1 and u.active and u.deleted_at is null and o.deleted_at is null`,
    [email],
  );
  if (users.length === 0) return { ok: true, accounts: 0 };
  const code = randomCode();
  await db.query(`insert into zt_login_codes (email, code_hash, expires_at, ip) values ($1,$2, now() + ($3 || ' minutes')::interval, $4)`, [email, sha256(`${email}:${code}`), String(env.codeTtlMinutes), ip]);
  const first = users[0];
  const brand = { name: first.org_name, color: (first.theme as { primary?: string })?.primary };
  const text = `Dein Anmeldecode für ${first.org_name}: ${code}\n\nDer Code ist ${env.codeTtlMinutes} Minuten gültig. Wenn du dich nicht anmelden wolltest, ignoriere diese Nachricht.`;
  const html = layout('Dein Anmeldecode', `<p>Hallo ${escapeHtml(first.name)},</p><p>dein Code für die Zeiterfassung:</p><p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:12px 0">${code}</p><p style="color:#6b7280">Gültig für ${env.codeTtlMinutes} Minuten.</p>`, brand);
  const res = await sendMail({ to: email, subject: `${code} – dein Anmeldecode`, html, text, template: 'login_code', orgId: first.org_id });
  return { ok: true, accounts: users.length, demoCode: env.demo || !env.resendApiKey ? code : undefined, ...(res.ok ? {} : {}) };
}

/** Step 2: verify code and create a session. Returns session token or null. */
export async function verifyLoginCode(emailRaw: string, code: string, ip: string | null, userAgent: string | null, orgSlug?: string | null): Promise<{ token: string; user: UserRow } | { error: string }> {
  const email = normalizeEmail(emailRaw);
  const db = await getDb();
  const { rows } = await db.query<{ id: string; code_hash: string; attempts: number }>(
    `select id, code_hash, attempts from zt_login_codes where email = $1 and consumed_at is null and expires_at > now() order by created_at desc limit 1`,
    [email],
  );
  const rec = rows[0];
  if (!rec) return { error: 'Kein gültiger Code. Bitte neuen Code anfordern.' };
  if (rec.attempts >= 5) return { error: 'Zu viele Versuche. Bitte neuen Code anfordern.' };
  if (rec.code_hash !== sha256(`${email}:${code.trim()}`)) {
    await db.query(`update zt_login_codes set attempts = attempts + 1 where id = $1`, [rec.id]);
    return { error: 'Der Code ist nicht korrekt.' };
  }
  await db.query(`update zt_login_codes set consumed_at = now() where id = $1`, [rec.id]);
  let sql = `select u.* from zt_users u join zt_orgs o on o.id = u.org_id where u.email = $1 and u.active and u.deleted_at is null and o.deleted_at is null`;
  const params: unknown[] = [email];
  if (orgSlug) {
    sql += ` and o.slug = $2`;
    params.push(orgSlug.toLowerCase());
  }
  sql += ` order by u.last_login_at desc nulls last, u.created_at asc limit 1`;
  const { rows: users } = await db.query<UserRow>(sql, params);
  const user = users[0];
  if (!user) return { error: 'Kein aktives Konto für diese E-Mail-Adresse.' };
  const token = randomToken(32);
  await db.query(`insert into zt_sessions (user_id, token_hash, expires_at, user_agent, ip) values ($1,$2, now() + ($3 || ' days')::interval, $4, $5)`, [user.id, tokenHash(token), String(env.sessionDays), userAgent?.slice(0, 300) ?? null, ip]);
  await db.query(`update zt_users set last_login_at = now() where id = $1`, [user.id]);
  await audit(db, { id: user.id, email: user.email, ip }, user.org_id, 'login', 'user', user.id, null, { method: 'email_code' });
  return { token, user };
}

export function sessionCookieOptions(): { name: string; options: { httpOnly: boolean; sameSite: 'lax'; secure: boolean; path: string; maxAge: number } } {
  return {
    name: SESSION_COOKIE,
    options: { httpOnly: true, sameSite: 'lax', secure: env.appUrl.startsWith('https://'), path: '/', maxAge: env.sessionDays * 86400 },
  };
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const { rows } = await db.query<UserRow & { session_id: string; org_deleted: string | null }>(
    `select u.*, s.id as session_id, o.deleted_at as org_deleted from zt_sessions s join zt_users u on u.id = s.user_id join zt_orgs o on o.id = u.org_id
     where s.token_hash = $1 and s.expires_at > now() and u.active and u.deleted_at is null`,
    [tokenHash(token)],
  );
  const row = rows[0];
  if (!row || row.org_deleted) return null;
  const org = await getOrgById(db, row.org_id);
  if (!org) return null;
  // touch session (at most every 10 minutes)
  db.query(`update zt_sessions set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '10 minutes'`, [row.session_id]).catch(() => undefined);
  const { session_id, org_deleted: _o, ...user } = row;
  return { user: user as UserRow, org, sessionId: session_id };
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return;
  const db = await getDb();
  await db.query(`delete from zt_sessions where token_hash = $1`, [tokenHash(token)]);
}

const ROLE_RANK: Record<Role, number> = { employee: 1, payroll: 2, manager: 3, admin: 4, owner: 5 };

export function hasRole(user: Pick<UserRow, 'role'>, min: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}
export function isManagerOrAbove(user: Pick<UserRow, 'role'>): boolean {
  return hasRole(user, 'manager');
}
export function isAdmin(user: Pick<UserRow, 'role'>): boolean {
  return hasRole(user, 'admin');
}
export function canSeePayroll(user: Pick<UserRow, 'role'>): boolean {
  return user.role === 'payroll' || hasRole(user, 'manager');
}

/** For pages: redirect to login when unauthenticated. */
export async function requireSession(min?: Role): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (min && !hasRole(s.user, min)) redirect('/app');
  return s;
}

/** For route handlers: returns null → caller responds 401. */
export async function apiSession(min?: Role): Promise<Session | null> {
  const s = await getSession();
  if (!s) return null;
  if (min && !hasRole(s.user, min)) return null;
  return s;
}

export function sessionContext(s: Session) {
  const rules = orgRules(s.org);
  return { rules, theme: orgTheme(s.org), employment: userEmployment(s.user, rules) };
}

export type { Db };
