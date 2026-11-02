import { getDb } from '@/db/client';
import { requireSession, sessionContext } from '@/lib/auth';
import { listUsers } from '@/lib/repo';
import { DEFAULT_EMPLOYMENT } from '@/domain/types';
import { PageHeader } from '@/components/ui';
import { EmployeeForm } from '../EmployeeForm';

export const dynamic = 'force-dynamic';

export default async function NewEmployeePage() {
  const s = await requireSession('admin');
  const { rules } = sessionContext(s);
  const db = await getDb();
  const users = await listUsers(db, s.org.id);
  const managers = users.filter((u) => ['owner', 'admin', 'manager'].includes(u.role)).map((u) => ({ id: u.id, name: u.name }));
  return (
    <div>
      <PageHeader title="Mitarbeiter:in einladen" subtitle="Die Person erhält eine E-Mail mit Anmeldeanleitung" />
      <EmployeeForm
        initial={{ email: '', name: '', role: 'employee', personnelNo: '', managerId: '', active: true, employment: { ...DEFAULT_EMPLOYMENT, weeklyMinutes: rules.normalWeeklyMinutes, workDays: rules.defaultWorkDays, startDate: new Date().toISOString().slice(0, 10) } }}
        managers={managers}
        isOwner={s.user.role === 'owner'}
        selfId={s.user.id}
      />
    </div>
  );
}
