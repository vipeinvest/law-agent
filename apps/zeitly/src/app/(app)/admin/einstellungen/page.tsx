import { requireSession, sessionContext } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { SettingsForm } from './SettingsForm';
import { RetentionPanel } from './RetentionPanel';
import { DEFAULT_PAYROLL_CODES, payrollCodes } from '@/lib/export/payroll-xlsx';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const s = await requireSession('admin');
  const { rules, theme } = sessionContext(s);
  return (
    <div>
      <PageHeader title="Einstellungen" subtitle="Betrieb, Arbeitszeitregeln, Erscheinungsbild, Lohnarten" />
      <SettingsForm
        org={{ name: s.org.name, legalName: s.org.legal_name ?? '', address: s.org.address ?? '', uidNumber: s.org.uid_number ?? '', contactEmail: s.org.contact_email ?? '', payrollEmail: s.org.payroll_email ?? '', timeZone: s.org.time_zone, slug: s.org.slug }}
        rules={rules}
        theme={theme}
        codes={payrollCodes(s.org)}
        defaultCodes={DEFAULT_PAYROLL_CODES}
        loginUrl={`${env.appUrl}/login?org=${encodeURIComponent(s.org.slug)}`}
      />
      <div className="mt-6">
        <RetentionPanel isOwner={s.user.role === 'owner'} />
      </div>
    </div>
  );
}
