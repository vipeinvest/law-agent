import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  login: 'Anmeldung',
  'entry.create': 'Buchung angelegt',
  'entry.update': 'Buchung geändert',
  'entry.delete': 'Buchung gelöscht',
  'timer.start': 'Stempel Start',
  'timer.stop': 'Stempel Stopp',
  'timer.break_start': 'Pause Start',
  'timer.break_end': 'Pause Ende',
  'timer.update': 'Stempel geändert',
  'timer.discard': 'Stempel verworfen',
  'absence.create': 'Abwesenheit angelegt',
  'absence.approved': 'Abwesenheit genehmigt',
  'absence.rejected': 'Abwesenheit abgelehnt',
  'absence.delete': 'Abwesenheit entfernt',
  'period.submit': 'Monat eingereicht',
  'period.approve': 'Monat freigegeben',
  'period.reopen': 'Monat wieder geöffnet',
  'period.export': 'Monat exportiert',
  'user.create': 'Mitarbeiter angelegt',
  'user.update': 'Mitarbeiter geändert',
  'project.create': 'Projekt angelegt',
  'project.update': 'Projekt geändert',
  'org.update': 'Einstellungen geändert',
  'export.journal': 'PDF-Export',
  'export.xlsx': 'Excel-Export',
  'export.csv': 'CSV-Export',
  'export.projects': 'Projekt-Export',
  'export.send': 'Export versendet',
  'import.run': 'Import',
  'me.export': 'Datenauskunft',
};

export default async function AuditPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const s = await requireSession('admin');
  const db = await getDb();
  const page = Math.max(1, Number(searchParams.page || 1));
  const q = (searchParams.q || '').trim();
  const params: unknown[] = [s.org.id];
  let where = `org_id = $1`;
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where += ` and (lower(coalesce(actor_email,'')) like $2 or lower(action) like $2 or lower(entity) like $2 or lower(coalesce(after::text,'')) like $2)`;
  }
  params.push(100, (page - 1) * 100);
  const { rows } = await db.query<{ id: number; actor_email: string | null; action: string; entity: string; entity_id: string | null; at: string; ip: string | null; before: unknown; after: unknown }>(`select id, actor_email, action, entity, entity_id, at, ip, before, after from zt_audit_log where ${where} order by at desc limit $${params.length - 1} offset $${params.length}`, params);
  return (
    <div>
      <PageHeader title="Protokoll" subtitle="Unveränderliches Änderungsprotokoll (wer, wann, was) – Nachweis für Prüfungen" />
      <form className="flex gap-2 mb-3">
        <input name="q" className="input" placeholder="Suche: E-Mail, Aktion, Text" defaultValue={q} />
        <button className="btn-secondary">Suchen</button>
      </form>
      <Card padded={false}>
        <div className="overflow-x-auto p-2">
          <table className="table min-w-[720px] text-xs">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Wer</th>
                <th>Aktion</th>
                <th>Objekt</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(r.at, s.org.time_zone)}</td>
                  <td>{r.actor_email}</td>
                  <td className="font-medium">{ACTION_LABELS[r.action] || r.action}</td>
                  <td>
                    {r.entity} <span className="text-muted">{r.entity_id?.slice(0, 8)}</span>
                  </td>
                  <td className="max-w-[420px]">
                    <details>
                      <summary className="cursor-pointer text-muted">{summarize(r.before, r.after)}</summary>
                      <pre className="whitespace-pre-wrap break-all text-[10px] bg-gray-50 rounded p-2 mt-1">{JSON.stringify({ vorher: r.before, nachher: r.after }, null, 1)}</pre>
                    </details>
                  </td>
                  <td className="text-muted">{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between p-3 text-sm">
          {page > 1 ? (
            <a className="underline" href={`/admin/protokoll?q=${encodeURIComponent(q)}&page=${page - 1}`}>
              ‹ Neuer
            </a>
          ) : (
            <span />
          )}
          {rows.length === 100 && (
            <a className="underline" href={`/admin/protokoll?q=${encodeURIComponent(q)}&page=${page + 1}`}>
              Älter ›
            </a>
          )}
        </div>
      </Card>
    </div>
  );
}

function summarize(before: unknown, after: unknown): string {
  const a = (after ?? before) as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return '–';
  const keys = ['date', 'start_at', 'end_at', 'year', 'month', 'type', 'status', 'name', 'email', 'reason', 'to', 'filename'];
  return keys
    .filter((k) => a[k] != null)
    .map((k) => `${k}: ${String(a[k]).slice(0, 24)}`)
    .join(' · ') || Object.keys(a).slice(0, 4).join(', ');
}
