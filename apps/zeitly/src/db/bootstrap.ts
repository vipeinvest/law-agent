import type { Db } from './client';

/** Creates the first organisation and owner when the database is empty (env-driven, idempotent). */
export async function bootstrap(db: Db): Promise<void> {
  const slug = process.env.BOOTSTRAP_ORG_SLUG!.toLowerCase();
  const email = process.env.BOOTSTRAP_OWNER_EMAIL!.toLowerCase();
  const { rows } = await db.query<{ id: string }>(`select id from zt_orgs where slug = $1`, [slug]);
  let orgId = rows[0]?.id;
  if (!orgId) {
    const ins = await db.query<{ id: string }>(`insert into zt_orgs (slug, name) values ($1, $2) returning id`, [slug, process.env.BOOTSTRAP_ORG_NAME || slug]);
    orgId = ins.rows[0].id;
    console.info(`[bootstrap] created org ${slug}`);
  }
  const u = await db.query<{ id: string }>(`select id from zt_users where org_id = $1 and email = $2`, [orgId, email]);
  if (!u.rows[0]) {
    await db.query(`insert into zt_users (org_id, email, name, role, invited_at) values ($1,$2,$3,'owner', now())`, [orgId, email, process.env.BOOTSTRAP_OWNER_NAME || email]);
    console.info(`[bootstrap] created owner ${email}`);
  }
}
