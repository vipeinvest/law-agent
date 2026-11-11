import { requireSession } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { ImportWizard } from './ImportWizard';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  await requireSession('admin');
  return (
    <div>
      <PageHeader title="Excel-Import" subtitle="Bestehende Zeitaufzeichnungen (Excel/CSV) übernehmen – Spalten frei zuordnen, Vorschau, dann importieren" />
      <ImportWizard />
    </div>
  );
}
