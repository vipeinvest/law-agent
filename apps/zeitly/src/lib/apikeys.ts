import 'server-only';
import type { DbClient } from '@/db/client';
import { ApiError } from './api';
import { audit, type AuditActor } from './audit';
import { env } from './env';
import { hmac, randomToken } from './crypto';
import { findApiKey, type ApiKeyRow } from './repo-v2';

export const API_SCOPES = ['read:employees', 'read:time', 'read:payroll', 'read:profiles', 'read:shifts'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

function keyHash(key: string): string {
  return hmac(env.sessionSecret || 'dev', `apikey:${key}`);
}

/** Creates a key; the plaintext is returned exactly once. Format: zt_live_<prefix>.<secret> */
export async function createApiKey(db: DbClient, orgId: string, name: string, scopes: ApiScope[], actor: AuditActor): Promise<{ key: string; row: ApiKeyRow }> {
  const prefix = randomToken(6).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const secret = randomToken(32);
  const key = `zt_live_${prefix}.${secret}`;
  const { rows } = await db.query<ApiKeyRow>(`insert into zt_api_keys (org_id, name, key_prefix, key_hash, scopes, created_by) values ($1,$2,$3,$4,$5,$6) returning id, org_id, name, key_prefix, scopes, created_at, last_used_at, revoked_at`, [orgId, name.trim().slice(0, 80), prefix, keyHash(key), scopes, actor.id]);
  await audit(db, actor, orgId, 'apikey.create', 'api_key', rows[0].id, null, { name, scopes, prefix });
  return { key, row: rows[0] };
}

export async function revokeApiKey(db: DbClient, orgId: string, id: string, actor: AuditActor): Promise<void> {
  await db.query(`update zt_api_keys set revoked_at = now() where org_id = $1 and id = $2 and revoked_at is null`, [orgId, id]);
  await audit(db, actor, orgId, 'apikey.revoke', 'api_key', id, null, null);
}

export interface ApiPrincipal {
  orgId: string;
  keyId: string;
  scopes: string[];
  timeZone: string;
}

/** Authenticates `Authorization: Bearer zt_live_…` and checks the scope. */
export async function requireApiKey(db: DbClient, req: Request, scope: ApiScope): Promise<ApiPrincipal> {
  const auth = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(zt_live_[A-Za-z0-9]+\.[A-Za-z0-9_-]+)$/.exec(auth);
  if (!m) throw new ApiError(401, 'API-Schlüssel fehlt (Authorization: Bearer zt_live_…).');
  const row = await findApiKey(db, keyHash(m[1]));
  if (!row) throw new ApiError(401, 'API-Schlüssel ungültig oder widerrufen.');
  if (!row.scopes.includes(scope)) throw new ApiError(403, `Schlüssel hat nicht die Berechtigung ${scope}.`);
  return { orgId: row.org_id, keyId: row.id, scopes: row.scopes, timeZone: row.time_zone };
}
