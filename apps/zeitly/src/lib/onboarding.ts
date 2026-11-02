import 'server-only';
import { createHash } from 'node:crypto';
import type { DbClient } from '@/db/client';
import { ApiError } from './api';
import { audit, type AuditActor } from './audit';
import { env } from './env';
import { hmac, randomToken } from './crypto';
import { escapeHtml, layout, sendMail } from './mail';
import type { OrgRow, UserRow } from './org';
import { getOrgById } from './org';
import { getUser } from './repo';
import { createOnboarding, getFileWithContent, getOnboardingByHash, getProfile, insertFile, latestOnboarding, listFiles, setOnboardingStatus, upsertProfile, type FileRow, type OnboardingRow, type ProfileRow } from './repo-v2';
import { checkProfile, completeness, consentsSchema, DOC_KINDS, profileSchema, type DocKind, type Profile, type ProfileInput } from '@/domain/onboarding';
import { aiEnabled, extractDocument, type Extracted } from './ai';

function tokenHash(token: string): string {
  return hmac(env.sessionSecret || 'dev', `onboarding:${token}`);
}

export interface OnboardingContext {
  onboarding: OnboardingRow;
  user: UserRow;
  org: OrgRow;
  profile: ProfileRow | null;
  files: FileRow[];
}

export async function resolveToken(db: DbClient, token: string): Promise<OnboardingContext> {
  const ob = await getOnboardingByHash(db, tokenHash(token));
  if (!ob) throw new ApiError(404, 'Dieser Link ist ungültig.');
  if (ob.status === 'cancelled') throw new ApiError(410, 'Dieser Link wurde ersetzt. Bitte den neuesten Link aus deiner E-Mail verwenden.');
  if (new Date(ob.expires_at) < new Date() && ob.status !== 'submitted' && ob.status !== 'reviewed') {
    await setOnboardingStatus(db, ob.id, 'expired');
    throw new ApiError(410, 'Dieser Link ist abgelaufen. Bitte um einen neuen Link bitten.');
  }
  const [user, org] = await Promise.all([db.query<UserRow>(`select * from zt_users where id = $1 and deleted_at is null`, [ob.user_id]).then((r) => r.rows[0]), getOrgById(db, ob.org_id)]);
  if (!user || !org) throw new ApiError(404, 'Konto nicht gefunden.');
  if (ob.status === 'sent') await setOnboardingStatus(db, ob.id, 'opened');
  const [profile, files] = await Promise.all([getProfile(db, org.id, user.id), listFiles(db, org.id, user.id)]);
  return { onboarding: { ...ob, status: ob.status === 'sent' ? 'opened' : ob.status }, user, org, profile, files };
}

/** Admin: create (or renew) the onboarding link and mail it to the employee. */
export async function sendOnboardingInvite(db: DbClient, org: OrgRow, user: UserRow, actor: AuditActor, opts: { message?: string | null } = {}): Promise<{ link: string; onboarding: OnboardingRow }> {
  const token = randomToken(32);
  const ob = await createOnboarding(db, org.id, user.id, tokenHash(token), actor.id, 14);
  const link = `${env.appUrl}/onboarding/${token}`;
  const appName = (org.theme as { appName?: string })?.appName || org.name;
  const first = user.name.split(' ')[0];
  const text = `Hallo ${first},\n\nwillkommen bei ${org.name}! Damit deine Anmeldung bei der Sozialversicherung und die Lohnverrechnung rechtzeitig klappen, brauchen wir ein paar Angaben von dir. Das dauert etwa 10 Minuten – am besten gleich am Handy:\n\n${link}\n\nDu kannst Ausweis, e-card und Meldezettel einfach fotografieren, Felder per Spracheingabe diktieren und jederzeit unterbrechen (der Link bleibt 14 Tage gültig). Deine Daten sind verschlüsselt und nur für die Personalverwaltung und die Lohnverrechnung sichtbar.\n\nNach dem Absenden bekommst du automatisch deinen Zugang zur Zeiterfassung ${appName}.\n${opts.message ? `\n${opts.message}\n` : ''}\nViele Grüße\n${org.name}`;
  await sendMail({
    to: user.email,
    subject: `Willkommen bei ${org.name} – deine Angaben für die Anmeldung`,
    text,
    html: layout(`Willkommen bei ${org.name}`, `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:${(org.theme as { primary?: string })?.primary || '#1f5f5b'};color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Fragebogen öffnen</a></p>`, { name: appName, color: (org.theme as { primary?: string })?.primary }),
    template: 'onboarding_invite',
    orgId: org.id,
  });
  await db.query(`update zt_users set invited_at = coalesce(invited_at, now()) where id = $1`, [user.id]);
  await audit(db, actor, org.id, 'onboarding.invite', 'user', user.id, null, { onboardingId: ob.id, expiresAt: ob.expires_at });
  return { link, onboarding: ob };
}

/** Employee: save a (partial) step. Data is merged and validated leniently until submit. */
export async function saveStep(db: DbClient, ctx: OnboardingContext, patch: Partial<ProfileInput>, ip: string | null): Promise<ProfileRow> {
  if (ctx.onboarding.status === 'submitted' || ctx.onboarding.status === 'reviewed') throw new ApiError(409, 'Der Fragebogen wurde bereits abgesendet. Änderungen bitte an die Personalverwaltung melden.');
  const merged = deepMerge((ctx.profile?.data as Partial<ProfileInput>) ?? {}, patch);
  const docs = ctx.files.map((f) => f.kind);
  const parsed = profileSchema.safeParse(merged);
  const issues = parsed.success ? checkProfile(parsed.data, docs) : checkProfile(merged as Partial<Profile>, docs);
  const row = await upsertProfile(db, ctx.org.id, ctx.user.id, { data: merged, completeness: completeness(merged), validation: issues });
  await audit(db, { id: ctx.user.id, email: ctx.user.email, ip }, ctx.org.id, 'onboarding.save', 'profile', ctx.user.id, null, { fields: Object.keys(patch) });
  return row;
}

export async function uploadDocument(db: DbClient, ctx: OnboardingContext, kind: DocKind, filename: string, mime: string, content: Uint8Array, ip: string | null): Promise<{ file: FileRow; extracted: Extracted | null; suggestions: Partial<ProfileInput> }> {
  if (!(DOC_KINDS as readonly string[]).includes(kind)) throw new ApiError(400, 'Unbekannte Dokumentart.');
  if (content.length > 8 * 1024 * 1024) throw new ApiError(400, 'Datei größer als 8 MB.');
  if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(mime)) throw new ApiError(400, 'Nur Fotos (JPEG/PNG/WebP) oder PDF.');
  const sha256 = createHash('sha256').update(content).digest('hex');
  let extracted: Extracted | null = null;
  try {
    extracted = await extractDocument(kind, mime, content);
  } catch (e) {
    console.warn('[onboarding] extraction failed', e instanceof Error ? e.message : e);
  }
  const file = await insertFile(db, { orgId: ctx.org.id, userId: ctx.user.id, kind, filename, mime, content, sha256, extracted, via: 'onboarding' });
  await audit(db, { id: ctx.user.id, email: ctx.user.email, ip }, ctx.org.id, 'onboarding.upload', 'file', file.id, null, { kind, mime, size: content.length, sha256, extracted: !!extracted });
  return { file, extracted, suggestions: toSuggestions(extracted) };
}

function toSuggestions(x: Extracted | null): Partial<ProfileInput> {
  if (!x) return {};
  const s: Record<string, Record<string, unknown>> = {};
  const set = (group: string, key: string, v: unknown) => {
    if (v == null || v === '') return;
    s[group] = s[group] || {};
    s[group][key] = v;
  };
  set('person', 'firstName', x.firstName);
  set('person', 'lastName', x.lastName);
  set('person', 'birthDate', x.birthDate);
  set('person', 'birthPlace', x.birthPlace);
  set('person', 'nationality', x.nationality);
  set('person', 'gender', x.gender);
  set('person', 'svNumber', x.svNumber?.replace(/\D/g, ''));
  set('contact', 'street', x.street);
  set('contact', 'zip', x.zip);
  set('contact', 'city', x.city);
  set('contact', 'country', x.country);
  set('bank', 'iban', x.iban?.replace(/\s+/g, '').toUpperCase());
  set('bank', 'bic', x.bic);
  set('employment', 'workPermitType', x.residenceTitleType);
  set('employment', 'workPermitValidUntil', x.residenceTitleType ? x.validUntil : null);
  return s as Partial<ProfileInput>;
}

export async function submitQuestionnaire(db: DbClient, ctx: OnboardingContext, consents: unknown, ip: string | null): Promise<{ profile: ProfileRow; issues: ReturnType<typeof checkProfile> }> {
  if (ctx.onboarding.status === 'submitted' || ctx.onboarding.status === 'reviewed') throw new ApiError(409, 'Bereits abgesendet.');
  const data = (ctx.profile?.data ?? {}) as ProfileInput;
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(400, 'Bitte alle Pflichtfelder ausfüllen.', parsed.error.flatten());
  const c = consentsSchema.safeParse(consents);
  if (!c.success) throw new ApiError(400, 'Bitte alle Bestätigungen setzen.', c.error.flatten());
  const docs = ctx.files.map((f) => f.kind);
  const issues = checkProfile(parsed.data, docs);
  const blocking = issues.filter((i) => i.severity === 'error' && !i.field.startsWith('docs.'));
  if (blocking.length) throw new ApiError(400, blocking.map((b) => b.message).join(' '), { issues: blocking });
  const profile = await upsertProfile(db, ctx.org.id, ctx.user.id, { data: parsed.data, consents: { ...c.data, at: new Date().toISOString(), ip }, completeness: 100, validation: issues, submitted: true });
  await setOnboardingStatus(db, ctx.onboarding.id, 'submitted');
  // keep the user record in sync (name, employment start/hours) – only fills gaps, never overwrites admin choices silently
  const emp = (ctx.user.employment || {}) as Record<string, unknown>;
  const newEmp = { ...emp, startDate: emp.startDate || parsed.data.employment.startDate, weeklyMinutes: emp.weeklyMinutes || Math.round(parsed.data.employment.weeklyHours * 60) };
  await db.query(`update zt_users set name = $2, employment = $3, consent_at = coalesce(consent_at, now()), updated_at = now() where id = $1`, [ctx.user.id, `${parsed.data.person.firstName} ${parsed.data.person.lastName}`.trim(), JSON.stringify(newEmp)]);
  await audit(db, { id: ctx.user.id, email: ctx.user.email, ip }, ctx.org.id, 'onboarding.submit', 'profile', ctx.user.id, null, { completeness: 100, issues: issues.length });
  await notifyAfterSubmit(db, ctx, issues);
  return { profile, issues };
}

async function notifyAfterSubmit(db: DbClient, ctx: OnboardingContext, issues: ReturnType<typeof checkProfile>): Promise<void> {
  const { org, user } = ctx;
  const appName = (org.theme as { appName?: string })?.appName || org.name;
  const color = (org.theme as { primary?: string })?.primary;
  // 1) employee: access to the time tracking app
  const loginLink = `${env.appUrl}/login?org=${encodeURIComponent(org.slug)}`;
  const textEmp = `Danke, ${user.name.split(' ')[0]} – dein Fragebogen ist eingegangen.\n\nDein Zugang zur Zeiterfassung ${appName}:\n${loginLink}\n\nSo geht's: Link öffnen, E-Mail ${user.email} eingeben, 6-stelligen Code aus der Mail eintippen. Kein Passwort nötig. Am Handy: „Zum Startbildschirm hinzufügen“, dann funktioniert ${appName} wie eine App – auch offline.\n\nIn der App findest du unter „Profil“ deine Arbeitszeitregeln und kannst deine Aufzeichnungen jederzeit herunterladen.\n\nViele Grüße\n${org.name}`;
  await sendMail({ to: user.email, subject: `Dein Zugang zu ${appName}`, text: textEmp, html: layout(`Dein Zugang zu ${appName}`, `<p>${escapeHtml(textEmp).replace(/\n/g, '<br>')}</p><p><a href="${loginLink}" style="display:inline-block;padding:12px 18px;background:${color || '#1f5f5b'};color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Jetzt anmelden</a></p>`, { name: appName, color }), template: 'onboarding_access', orgId: org.id });
  // 2) admins: review request
  const { rows: admins } = await db.query<{ email: string; name: string }>(`select email, name from zt_users where org_id = $1 and active and deleted_at is null and role in ('owner','admin') limit 10`, [org.id]);
  const errs = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');
  const textAdm = `${user.name} hat den Onboarding-Fragebogen ausgefüllt.\n\nPrüfung: ${errs.length} offene Punkte, ${warns.length} Hinweise.${issues.length ? '\n' + issues.map((i) => `- [${i.severity}] ${i.message}`).join('\n') : ''}\n\nPrüfen, Personalstammblatt und ÖGK-Mindestangaben erzeugen und an die Lohnverrechnung senden:\n${env.appUrl}/admin/mitarbeiter/${user.id}?tab=onboarding\n\nWichtig: Die Anmeldung bei der ÖGK muss VOR Arbeitsantritt erfolgen (§ 33 ASVG).`;
  for (const a of admins) {
    await sendMail({ to: a.email, subject: `Onboarding abgeschlossen: ${user.name} – bitte prüfen`, text: textAdm, html: layout('Onboarding abgeschlossen', `<p>${escapeHtml(textAdm).replace(/\n/g, '<br>')}</p>`, { name: appName, color }), template: 'onboarding_submitted', orgId: org.id });
  }
}

/** Admin: mark reviewed, optionally send the payroll package. */
export async function markReviewed(db: DbClient, org: OrgRow, userId: string, actor: AuditActor): Promise<void> {
  const ob = await latestOnboarding(db, org.id, userId);
  if (ob) await setOnboardingStatus(db, ob.id, 'reviewed');
  await db.query(`update zt_employee_profiles set reviewed_by = $3, reviewed_at = now(), updated_at = now() where org_id = $1 and user_id = $2`, [org.id, userId, actor.id]);
  await audit(db, actor, org.id, 'onboarding.review', 'profile', userId, null, { reviewed: true });
}

export async function markSentToPayroll(db: DbClient, org: OrgRow, userId: string, actor: AuditActor, to: string, attachments: string[]): Promise<void> {
  await db.query(`update zt_employee_profiles set sent_to_payroll_at = now(), updated_at = now() where org_id = $1 and user_id = $2`, [org.id, userId]);
  await audit(db, actor, org.id, 'onboarding.send_payroll', 'profile', userId, null, { to, attachments });
}

export async function loadOnboardingForAdmin(db: DbClient, org: OrgRow, userId: string): Promise<{ user: UserRow; profile: ProfileRow | null; files: FileRow[]; onboarding: OnboardingRow | null }> {
  const user = await getUser(db, org.id, userId);
  if (!user) throw new ApiError(404, 'Mitarbeiter nicht gefunden.');
  const [profile, files, onboarding] = await Promise.all([getProfile(db, org.id, userId), listFiles(db, org.id, userId), latestOnboarding(db, org.id, userId)]);
  return { user, profile, files, onboarding };
}

export { getFileWithContent, aiEnabled };

function deepMerge<T extends Record<string, unknown>>(a: T, b: Partial<T>): T {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    else out[k] = v;
  }
  return out as T;
}
