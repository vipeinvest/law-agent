import { z } from 'zod';
import { getDb } from '@/db/client';
import { apiSession } from '@/lib/auth';
import { fail, handler, json, unauthorized } from '@/lib/api';
import { getUser } from '@/lib/repo';
import { evaluateUserMonth } from '@/lib/period';
import { aiEnabled, monthlyReviewNarrative } from '@/lib/ai';
import { deterministicReview } from '@/lib/review';
import { fmtMonth } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const s = await apiSession('manager');
  if (!s) return unauthorized();
  const q = z.object({ userId: z.string().uuid(), year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) }).safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return fail(400, 'userId, year, month erforderlich.');
  const db = await getDb();
  const user = await getUser(db, s.org.id, q.data.userId);
  if (!user) return fail(404, 'Mitarbeiter nicht gefunden.');
  const { summary } = await evaluateUserMonth(db, s.org, user, q.data.year, q.data.month);
  const text = deterministicReview(user.name, summary);
  let ai: string | null = null;
  if (aiEnabled() && new URL(req.url).searchParams.get('ai') !== '0') {
    try {
      ai = await monthlyReviewNarrative({ employeeName: user.name, month: fmtMonth(q.data.year, q.data.month), facts: { target: summary.targetMinutes, worked: summary.workedMinutes, overtime: summary.overtimeMinutes, mehrarbeit: summary.mehrarbeitMinutes, night: summary.nightMinutes, sunday: summary.sundayMinutes, holidayWork: summary.holidayMinutes, balanceEnd: summary.balanceEndMinutes, absences: summary.absenceDays }, violations: summary.violations.filter((v) => v.severity !== 'info').map((v) => ({ code: v.code, severity: v.severity, date: v.date, message: v.message, legalRef: v.legalRef })) });
    } catch (e) {
      console.warn('[review] ai failed', e instanceof Error ? e.message : e);
    }
  }
  return json({ text, ai, aiEnabled: aiEnabled() });
});
