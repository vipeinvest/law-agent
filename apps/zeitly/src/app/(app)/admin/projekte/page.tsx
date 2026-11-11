import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth';
import { listProjects } from '@/lib/repo';
import { PageHeader } from '@/components/ui';
import { ProjectsTable } from './ProjectsTable';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const s = await requireSession('admin');
  const db = await getDb();
  const projects = await listProjects(db, s.org.id, false);
  return (
    <div>
      <PageHeader title="Projekte & Kostenstellen" subtitle="Für Projektzeit-Auswertung und Buchhaltung (Kostenstellen, Kunden, verrechenbar)" />
      <ProjectsTable projects={projects.map((p) => ({ id: p.id, code: p.code, name: p.name, customer: p.customer, costCenter: p.cost_center, color: p.color, billable: p.billable, active: p.active }))} />
    </div>
  );
}
