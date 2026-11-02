import 'server-only';

function bool(v: string | undefined, def = false): boolean {
  if (v == null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export const env = {
  appUrl: (process.env.APP_URL || 'http://localhost:3100').replace(/\/$/, ''),
  demo: bool(process.env.ZEITLY_DEMO),
  dbKind: (process.env.ZEITLY_DB || (process.env.DATABASE_URL ? 'postgres' : 'pglite')) as 'postgres' | 'pglite',
  sessionSecret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' && !bool(process.env.ZEITLY_DEMO) ? '' : 'dev-secret-change-me-please-0123456789'),
  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || 'Zeitly <notify@malelu.io>',
  mailReplyTo: process.env.MAIL_REPLY_TO || 'office@malelu.io',
  operatorName: process.env.OPERATOR_NAME || 'MALELU AI – Peter Vitzthum',
  operatorAddress: process.env.OPERATOR_ADDRESS || 'Salzburg, Österreich',
  operatorEmail: process.env.OPERATOR_EMAIL || 'office@malelu.io',
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  codeTtlMinutes: Number(process.env.LOGIN_CODE_TTL_MINUTES || 10),
  version: process.env.ZEITLY_VERSION || process.env.npm_package_version || '0.1.0',
  buildSha: process.env.GIT_SHA || '',
};

export function assertProdConfig(): string[] {
  const problems: string[] = [];
  if (process.env.NODE_ENV === 'production' && !env.demo) {
    if (!env.sessionSecret || env.sessionSecret.length < 32) problems.push('SESSION_SECRET missing or shorter than 32 chars');
    if (!env.resendApiKey) problems.push('RESEND_API_KEY missing (login codes cannot be sent)');
    if (env.dbKind === 'postgres' && !process.env.DATABASE_URL) problems.push('DATABASE_URL missing');
    if (!/^https:\/\//.test(env.appUrl)) problems.push('APP_URL should be https://');
  }
  return problems;
}
