import 'server-only';
import type { DbClient } from '@/db/client';

export interface AuditActor {
  id: string | null;
  email: string | null;
  ip?: string | null;
}

export async function audit(
  db: DbClient,
  actor: AuditActor,
  orgId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
): Promise<void> {
  await db.query(`insert into zt_audit_log (org_id, actor_id, actor_email, action, entity, entity_id, before, after, ip) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
    orgId,
    actor.id,
    actor.email,
    action,
    entity,
    entityId,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after),
    actor.ip ?? null,
  ]);
}
