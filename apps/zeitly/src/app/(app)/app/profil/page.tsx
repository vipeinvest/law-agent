import Link from 'next/link';
import { requireSession, sessionContext } from '@/lib/auth';
import { fmtDateTime, fmtH, ROLE_LABELS, WEEKDAYS_SHORT } from '@/lib/format';
import { Card, PageHeader } from '@/components/ui';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const s = await requireSession();
  const { employment } = sessionContext(s);
  return (
    <div>
      <PageHeader title="Profil" subtitle={s.user.email} />
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Meine Daten">
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Name</dt>
            <dd>{s.user.name}</dd>
            <dt className="text-muted">Rolle</dt>
            <dd>{ROLE_LABELS[s.user.role]}</dd>
            <dt className="text-muted">Betrieb</dt>
            <dd>{s.org.name}</dd>
            <dt className="text-muted">Personalnummer</dt>
            <dd>{s.user.personnel_no || '–'}</dd>
            <dt className="text-muted">Letzte Anmeldung</dt>
            <dd>{fmtDateTime(s.user.last_login_at, s.org.time_zone)}</dd>
          </dl>
          <p className="text-xs text-muted mt-3">Änderungen an Stammdaten nimmt dein Admin vor.</p>
        </Card>
        <Card title="Arbeitszeitmodell">
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Wochenstunden</dt>
            <dd>{fmtH(employment.weeklyMinutes)}</dd>
            <dt className="text-muted">Arbeitstage</dt>
            <dd>{employment.workDays.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ')}</dd>
            <dt className="text-muted">Erfassung</dt>
            <dd>{employment.recordMode === 'full' ? 'Beginn, Ende, Pausen' : 'Nur Dauer (§ 26 Abs 3 AZG)'}</dd>
            <dt className="text-muted">Gleitzeit</dt>
            <dd>{employment.gleitzeit ? 'Ja (Normalarbeitszeit bis 10 h)' : 'Nein'}</dd>
            <dt className="text-muted">Urlaubsanspruch</dt>
            <dd>{employment.vacationDaysPerYear} Arbeitstage / Jahr</dd>
            <dt className="text-muted">Eintritt</dt>
            <dd>{employment.startDate ?? '–'}</dd>
          </dl>
        </Card>
        <Card title="Meine Aufzeichnungen">
          <p className="text-sm text-muted mb-3">Du hast jederzeit Anspruch auf deine Arbeitszeitaufzeichnungen (§ 26 Abs 8 AZG) und auf Auskunft nach Art. 15 DSGVO.</p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary btn-sm" href="/api/me/export?format=xlsx">
              Alle Buchungen (Excel)
            </a>
            <a className="btn-secondary btn-sm" href="/api/me/export?format=json">
              Datenauskunft (JSON)
            </a>
          </div>
        </Card>
        <Card title="Datenschutz & Hilfe">
          <ul className="text-sm space-y-1">
            <li>
              <Link className="underline" href="/datenschutz">
                Datenschutzinformation
              </Link>
            </li>
            <li>
              <Link className="underline" href="/impressum">
                Impressum / Betreiber
              </Link>
            </li>
            <li className="text-muted">
              Fragen zur App: <a className="underline" href={`mailto:${env.operatorEmail}`}>{env.operatorEmail}</a>
            </li>
          </ul>
          <form action="/api/auth/logout" method="post" className="mt-4">
            <button className="btn-ghost btn-sm border border-line">Abmelden</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
