import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireSession, sessionContext, hasRole } from '@/lib/auth';
import { getUser, isLockedStatus, listUsers, visibleUsers } from '@/lib/repo';
import { evaluateUserMonth, prevMonth } from '@/lib/period';
import { userEmployment } from '@/lib/org';
import { toISODate } from '@/domain/time';
import { fmtH, fmtMonth, PERIOD_LABELS } from '@/lib/format';
import { Badge, Card, PageHeader, SeverityBadge, Stat } from '@/components/ui';
import { DayList } from '@/components/DayList';
import { EmployeeForm } from '../EmployeeForm';
import { PeriodActions } from '../../freigaben/Actions';
import { AbsenceForm } from '@/app/(app)/app/abwesenheiten/AbsenceForm';
import { OnboardingPanel } from './OnboardingPanel';
import { ReviewButton } from './ReviewButton';
import { loadOnboardingForAdmin } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

export default async function EmployeeDetail({ params, searchParams }: { params: { id: string }; searchParams: { m?: string; tab?: string } }) {
  const s = await requireSession('manager');
  const { rules } = sessionContext(s);
  const db = await getDb();
  const user = await getUser(db, s.org.id, params.id);
  if (!user) notFound();
  const visible = await visibleUsers(db, s.user);
  if (!visible.some((u) => u.id === user.id)) notFound();
  const tz = s.org.time_zone;
  const today = toISODate(new Date(), tz);
  const m = /^\d{4}-\d{2}$/.test(searchParams.m ?? '') ? searchParams.m! : today.slice(0, 7);
  const year = Number(m.slice(0, 4));
  const month = Number(m.slice(5, 7));
  const { summary, period, projects } = await evaluateUserMonth(db, s.org, user, year, month);
  const emp = userEmployment(user, rules);
  const [py, pm] = prevMonth(year, month);
  const [ny, nm] = month === 12 ? [year + 1, 1] : [year, month + 1];
  const canEditMaster = hasRole(s.user, 'admin');
  const tab = (searchParams.tab === 'stammdaten' || searchParams.tab === 'onboarding') && canEditMaster ? searchParams.tab : 'zeiten';
  const ob = tab === 'onboarding' ? await loadOnboardingForAdmin(db, s.org, user.id) : null;
  const managers = (await listUsers(db, s.org.id)).filter((u) => ['owner', 'admin', 'manager'].includes(u.role)).map((u) => ({ id: u.id, name: u.name }));
  const status = period?.status ?? 'open';
  const nonInfo = summary.violations.filter((v) => v.severity !== 'info');

  return (
    <div>
      <PageHeader
        title={user.name}
        subtitle={`${user.email}${user.personnel_no ? ' · ' + user.personnel_no : ''} · ${fmtH(emp.weeklyMinutes)}/Woche`}
        action={
          <div className="flex gap-1">
            <Link href={`/admin/mitarbeiter/${user.id}?m=${m}`} className={`tab ${tab === 'zeiten' ? 'tab-active' : ''}`}>
              Zeiten
            </Link>
            {canEditMaster && (
              <>
                <Link href={`/admin/mitarbeiter/${user.id}?m=${m}&tab=stammdaten`} className={`tab ${tab === 'stammdaten' ? 'tab-active' : ''}`}>
                  Stammdaten
                </Link>
                <Link href={`/admin/mitarbeiter/${user.id}?m=${m}&tab=onboarding`} className={`tab ${tab === 'onboarding' ? 'tab-active' : ''}`}>
                  Onboarding
                </Link>
              </>
            )}
          </div>
        }
      />
      {tab === 'onboarding' && ob ? (
        <OnboardingPanel
          userId={user.id}
          userName={user.name}
          payrollEmail={s.org.payroll_email}
          onboarding={ob.onboarding ? { status: ob.onboarding.status, expiresAt: ob.onboarding.expires_at, submittedAt: ob.onboarding.submitted_at } : null}
          profile={ob.profile ? { data: ob.profile.data as Record<string, Record<string, unknown>>, completeness: ob.profile.completeness, validation: ob.profile.validation, submittedAt: ob.profile.submitted_at, reviewedAt: ob.profile.reviewed_at, sentToPayrollAt: ob.profile.sent_to_payroll_at } : null}
          files={ob.files.map((f) => ({ id: f.id, kind: f.kind, filename: f.filename, mime: f.mime, size: f.size_bytes }))}
        />
      ) : tab === 'stammdaten' ? (
        <EmployeeForm initial={{ id: user.id, email: user.email, name: user.name, role: user.role, personnelNo: user.personnel_no ?? '', managerId: user.manager_id ?? '', active: user.active, employment: emp }} managers={managers} isOwner={s.user.role === 'owner'} selfId={s.user.id} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Link className="btn-ghost btn-sm" href={`/admin/mitarbeiter/${user.id}?m=${py}-${String(pm).padStart(2, '0')}`}>
                ‹
              </Link>
              <span className="font-semibold">{fmtMonth(year, month)}</span>
              <Link className="btn-ghost btn-sm" href={`/admin/mitarbeiter/${user.id}?m=${ny}-${String(nm).padStart(2, '0')}`}>
                ›
              </Link>
              <Badge tone={status === 'approved' || status === 'exported' ? 'green' : status === 'submitted' ? 'blue' : 'gray'}>{PERIOD_LABELS[status]}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <a className="btn-ghost btn-sm" href={`/api/export/journal?year=${year}&month=${month}&userId=${user.id}&inline=1`} target="_blank" rel="noreferrer">
                PDF
              </a>
              <ReviewButton userId={user.id} year={year} month={month} />
              {user.id !== s.user.id || hasRole(s.user, 'admin') ? <PeriodActions userId={user.id} year={year} month={month} canReopen={hasRole(s.user, 'admin')} status={status} /> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Soll" value={fmtH(summary.targetMinutes)} />
            <Stat label="Ist" value={fmtH(summary.workedMinutes)} hint={summary.creditMinutes ? `+ ${fmtH(summary.creditMinutes)} Gutschrift` : undefined} />
            <Stat label="Saldo Monatsende" value={fmtH(summary.balanceEndMinutes, true)} hint={`Start ${fmtH(summary.balanceStartMinutes, true)}`} tone={summary.balanceEndMinutes < 0 ? 'bad' : 'good'} />
            <Stat label="Überstunden" value={fmtH(summary.overtimeMinutes)} hint={summary.mehrarbeitMinutes ? `Mehrarbeit ${fmtH(summary.mehrarbeitMinutes)}` : undefined} />
          </div>
          {nonInfo.length > 0 && (
            <Card title={`Prüfung (${nonInfo.length})`}>
              <ul className="space-y-1 text-sm max-h-48 overflow-auto">
                {nonInfo.map((v, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <SeverityBadge severity={v.severity} />
                    <span>
                      <a href={`#${v.date}`} className="font-medium">
                        {v.date.slice(8, 10)}.{v.date.slice(5, 7)}.
                      </a>{' '}
                      {v.message} <span className="text-muted">({v.legalRef})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Abwesenheit eintragen (für diese Person)">
            <AbsenceForm today={today} userId={user.id} />
          </Card>
          <DayList days={summary.days} projects={projects} recordMode={emp.recordMode} timeZone={tz} locked={isLockedStatus(status) && status !== 'submitted'} today={today} userId={user.id} compact />
        </div>
      )}
    </div>
  );
}
