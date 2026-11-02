import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth';
import { weekPlan } from '@/lib/roster';
import { listProjects } from '@/lib/repo';
import { listTemplates } from '@/lib/repo-v2';
import { addDays, isoWeekKey, toISODate, weekStart } from '@/domain/time';
import { fmtDate } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import { Planner } from './Planner';

export const dynamic = 'force-dynamic';

export default async function RosterPage({ searchParams }: { searchParams: { w?: string } }) {
  const s = await requireSession('manager');
  const db = await getDb();
  const today = toISODate(new Date(), s.org.time_zone);
  const monday = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(searchParams.w ?? '') ? searchParams.w! : addDays(today, 7));
  const [plan, projects, templates] = await Promise.all([weekPlan(db, s, monday), listProjects(db, s.org.id), listTemplates(db, s.org.id)]);
  const drafts = plan.shifts.filter((x) => x.status === 'draft').length;
  return (
    <div>
      <PageHeader
        title={`Dienstplan ${isoWeekKey(monday).replace('-W', ' · KW ')}`}
        subtitle={`${fmtDate(monday)} – ${fmtDate(addDays(monday, 6))} · ${plan.shifts.length} Schichten${drafts ? ` · ${drafts} unveröffentlicht` : ' · veröffentlicht'}`}
        action={
          <div className="flex items-center gap-1">
            <Link className="btn-ghost btn-sm" href={`/admin/dienstplan?w=${addDays(monday, -7)}`} aria-label="Vorige Woche">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link className="btn-ghost btn-sm" href={`/admin/dienstplan?w=${weekStart(today)}`}>
              Diese Woche
            </Link>
            <Link className="btn-ghost btn-sm" href={`/admin/dienstplan?w=${addDays(monday, 7)}`} aria-label="Nächste Woche">
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        }
      />
      <Planner
        monday={monday}
        days={plan.days}
        today={today}
        users={plan.users.map((u) => ({ id: u.id, name: u.name, weeklyMinutes: Number((u.employment as { weeklyMinutes?: number })?.weeklyMinutes ?? 2400), targetMode: (u.employment as { targetMode?: string })?.targetMode ?? 'contract' }))}
        shifts={plan.shifts.map((x) => ({ id: x.id, userId: x.user_id, date: x.date, start: x.start_time, end: x.end_time, breakMinutes: x.break_minutes, location: x.location, projectId: x.project_id, note: x.note, status: x.status, adopted: !!x.adopted_entry_id }))}
        projects={projects.map((p) => ({ id: p.id, code: p.code, name: p.name, color: p.color }))}
        templates={templates.map((t) => ({ id: t.id, name: t.name, start: t.start_time, end: t.end_time, breakMinutes: t.break_minutes, location: t.location, color: t.color }))}
        prevWeekCount={plan.prevWeekCount}
      />
    </div>
  );
}
