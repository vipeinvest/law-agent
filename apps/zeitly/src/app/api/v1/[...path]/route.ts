import { getDb } from '@/db/client';
import { fail, handler, json } from '@/lib/api';
import { requireApiKey, type ApiScope } from '@/lib/apikeys';
import { getOrgById, orgRules, userEmployment } from '@/lib/org';
import { listAbsences, listEntries, listUsers } from '@/lib/repo';
import { listShifts, getProfile, listFiles } from '@/lib/repo-v2';
import { evaluateUserMonth } from '@/lib/period';
import { hoursDecimal } from '@/lib/export/common';

export const dynamic = 'force-dynamic';

/**
 * Fairhours Public API v1 (read-only) for payroll/accounting systems.
 *   GET /api/v1/employees                         scope read:employees
 *   GET /api/v1/employees/{id}/profile            scope read:profiles   (onboarding master data)
 *   GET /api/v1/time-entries?from&to[&userId]     scope read:time
 *   GET /api/v1/absences?from&to                  scope read:time
 *   GET /api/v1/shifts?from&to                    scope read:shifts
 *   GET /api/v1/payroll/{year}/{month}            scope read:payroll    (buckets per employee, decimal hours)
 * Auth: Authorization: Bearer zt_live_…  ·  Pagination: none (monthly volumes are small); dates ISO, times UTC.
 */
export const GET = handler(async (req, { params }) => {
  const path = Array.isArray(params.path) ? (params.path as string[]) : [params.path];
  const url = new URL(req.url);
  const db = await getDb();
  const q = (k: string) => url.searchParams.get(k);
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  if (path[0] === 'employees' && path.length === 1) {
    const p = await requireApiKey(db, req, 'read:employees');
    const org = await getOrgById(db, p.orgId);
    const rules = orgRules(org!);
    const users = (await listUsers(db, p.orgId, { includeInactive: q('includeInactive') === '1' })).filter((u) => u.role !== 'payroll');
    return json({
      data: users.map((u) => {
        const e = userEmployment(u, rules);
        return { id: u.id, personnelNo: u.personnel_no, name: u.name, email: u.email, role: u.role, active: u.active, weeklyHours: hoursDecimal(e.weeklyMinutes), workDays: e.workDays, recordMode: e.recordMode, gleitzeit: e.gleitzeit, allIn: e.allIn, startDate: e.startDate ?? null, endDate: e.endDate ?? null, vacationDaysPerYear: e.vacationDaysPerYear };
      }),
    });
  }
  if (path[0] === 'employees' && path[2] === 'profile') {
    const p = await requireApiKey(db, req, 'read:profiles');
    const prof = await getProfile(db, p.orgId, path[1]);
    if (!prof) return fail(404, 'Kein Profil.');
    const files = await listFiles(db, p.orgId, path[1]);
    return json({ data: { userId: prof.user_id, submittedAt: prof.submitted_at, reviewedAt: prof.reviewed_at, completeness: prof.completeness, validation: prof.validation, profile: prof.data, documents: files.map((f) => ({ id: f.id, kind: f.kind, filename: f.filename, mime: f.mime, sizeBytes: f.size_bytes, sha256: f.sha256 })) } });
  }
  if (path[0] === 'time-entries' || path[0] === 'absences' || path[0] === 'shifts') {
    const scope: ApiScope = path[0] === 'shifts' ? 'read:shifts' : 'read:time';
    const p = await requireApiKey(db, req, scope);
    const from = q('from');
    const to = q('to');
    if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) return fail(400, 'from und to (YYYY-MM-DD) erforderlich.');
    if (path[0] === 'shifts') {
      const rows = await listShifts(db, p.orgId, from, to, q('userId') || undefined);
      return json({ data: rows.map((r) => ({ id: r.id, userId: r.user_id, date: r.date, start: r.start_time, end: r.end_time, breakMinutes: r.break_minutes, location: r.location, projectId: r.project_id, note: r.note, status: r.status, adoptedEntryId: r.adopted_entry_id })) });
    }
    const users = (await listUsers(db, p.orgId, { includeInactive: true })).filter((u) => !q('userId') || u.id === q('userId'));
    const out: unknown[] = [];
    for (const u of users) {
      if (path[0] === 'time-entries') {
        for (const e of await listEntries(db, p.orgId, u.id, from, to)) out.push({ id: e.id, userId: u.id, personnelNo: u.personnel_no, date: e.date, startAt: e.start_at, endAt: e.end_at, breakMinutes: e.break_minutes, durationMinutes: e.duration_minutes, type: e.type, location: e.location, projectId: e.project_id, note: e.note, source: e.source, status: e.status, updatedAt: e.updated_at });
      } else {
        for (const a of await listAbsences(db, p.orgId, u.id, from, to)) out.push({ id: a.id, userId: u.id, personnelNo: u.personnel_no, dateFrom: a.date_from, dateTo: a.date_to, type: a.type, halfDay: a.half_day, status: a.status, note: a.note });
      }
    }
    return json({ data: out });
  }
  if (path[0] === 'payroll' && path.length === 3) {
    const p = await requireApiKey(db, req, 'read:payroll');
    const year = Number(path[1]);
    const month = Number(path[2]);
    if (!year || !month || month < 1 || month > 12) return fail(400, 'Pfad: /payroll/{year}/{month}');
    const org = await getOrgById(db, p.orgId);
    const users = (await listUsers(db, p.orgId, { includeInactive: true })).filter((u) => u.role !== 'payroll');
    const data = [];
    for (const u of users) {
      const { summary, period } = await evaluateUserMonth(db, org!, u, year, month);
      const normal = Math.max(0, summary.workedMinutes - summary.overtimeMinutes - summary.mehrarbeitMinutes);
      data.push({
        userId: u.id,
        personnelNo: u.personnel_no,
        name: u.name,
        status: period?.status ?? 'open',
        submittedAt: period?.submitted_at ?? null,
        approvedAt: period?.approved_at ?? null,
        hours: { target: hoursDecimal(summary.targetMinutes), worked: hoursDecimal(summary.workedMinutes), travel: hoursDecimal(summary.travelMinutes), credit: hoursDecimal(summary.creditMinutes), normal: hoursDecimal(normal), mehrarbeit: hoursDecimal(summary.mehrarbeitMinutes), overtime: hoursDecimal(summary.overtimeMinutes), overtime50: hoursDecimal(summary.overtime50Minutes), overtime100: hoursDecimal(summary.overtime100Minutes), night: hoursDecimal(summary.nightMinutes), sunday: hoursDecimal(summary.sundayMinutes), holidayWork: hoursDecimal(summary.holidayMinutes), timeComp: hoursDecimal(summary.timeCompMinutes), balanceStart: hoursDecimal(summary.balanceStartMinutes), balanceEnd: hoursDecimal(summary.balanceEndMinutes) },
        days: { worked: summary.workedDays, holiday: summary.holidayDays, remoteOnly: summary.remoteOnlyDays, oncall: summary.oncallDays, ...summary.absenceDays },
        byProject: Object.fromEntries(Object.entries(summary.byProject).map(([k, v]) => [k, hoursDecimal(v)])),
        findings: summary.violations.filter((v) => v.severity !== 'info').map((v) => ({ code: v.code, severity: v.severity, date: v.date, message: v.message, legalRef: v.legalRef })),
      });
    }
    return json({ data, meta: { year, month, unit: 'decimal hours / days', generatedAt: new Date().toISOString() } });
  }
  return fail(404, 'Unbekannter Endpunkt. Siehe /api/v1 Dokumentation (ops/API.md).');
});
