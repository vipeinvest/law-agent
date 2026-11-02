import 'server-only';
import { env } from './env';
import { getDb } from '@/db/client';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  orgId?: string | null;
  attachments?: Array<{ filename: string; content: Buffer | Uint8Array }>;
  replyTo?: string;
}

export interface MailResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** In demo/dev mode without provider the content is returned for display. */
  previewText?: string;
}

const lastMails: MailInput[] = [];
export function getLastMails(): MailInput[] {
  return lastMails;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const db = await getDb();
  let result: MailResult;
  if (!env.resendApiKey) {
    lastMails.unshift(input);
    if (lastMails.length > 50) lastMails.pop();
    console.info(`[mail:dev] to=${input.to} subject="${input.subject}"\n${input.text}`);
    result = { ok: true, id: 'dev', previewText: input.text };
  } else {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(env.resendApiKey);
      const res = await resend.emails.send({
        from: env.mailFrom,
        to: input.to,
        replyTo: input.replyTo || env.mailReplyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
      });
      if (res.error) result = { ok: false, error: res.error.message };
      else result = { ok: true, id: res.data?.id };
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  await db
    .query(`insert into zt_mail_log (org_id, to_email, template, subject, status, provider_id, error) values ($1,$2,$3,$4,$5,$6,$7)`, [
      input.orgId ?? null,
      input.to,
      input.template,
      input.subject,
      result.ok ? 'sent' : 'failed',
      result.id ?? null,
      result.error ?? null,
    ])
    .catch(() => undefined);
  return result;
}

export function layout(title: string, bodyHtml: string, brand?: { name?: string; color?: string }): string {
  const color = brand?.color || '#1f5f5b';
  const name = brand?.name || 'Zeitly';
  return `<!doctype html><html lang="de"><body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:${color};color:#fff;padding:18px 24px;font-weight:700;font-size:18px">${escapeHtml(name)}</div>
    <div style="padding:24px;font-size:16px;line-height:1.5"><h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>${bodyHtml}</div>
    <div style="padding:14px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb">Diese Nachricht wurde automatisch von ${escapeHtml(name)} gesendet. Antworten gehen an ${escapeHtml(env.mailReplyTo)}.</div>
  </div></body></html>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
