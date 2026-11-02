'use client';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';

interface Preview {
  cutoffDate: string;
  formerEmployees: Array<{ id: string; name: string; email: string; endDate: string | null; entries: number; lastEntry: string | null }>;
  oldEntries: number;
  oldAbsences: number;
  oldAudit: number;
}

export function RetentionPanel({ isOwner }: { isOwner: boolean }) {
  const [p, setP] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/admin/retention').then(async (r) => r.ok && setP(await r.json()));
  }, []);
  async function run() {
    if (!p || !confirm(`Löschlauf wirklich ausführen? Daten bis ${p.cutoffDate} werden unwiderruflich gelöscht bzw. anonymisiert (wird protokolliert).`)) return;
    setBusy(true);
    const r = await fetch('/api/admin/retention', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || 'Fehler');
    setMsg(`Erledigt: ${d.deletedEntries} Buchungen, ${d.deletedAbsences} Abwesenheiten, ${d.deletedAudit} Protokolleinträge gelöscht; ${d.anonymized} ehemalige Mitarbeiter:innen anonymisiert.`);
    setP(await (await fetch('/api/admin/retention')).json());
  }
  const nothing = p && p.oldEntries === 0 && p.oldAbsences === 0 && p.formerEmployees.length === 0;
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-semibold mb-1">Datenschutz: Aufbewahrung & Löschlauf</h2>
      <p className="text-sm text-muted mb-3">Arbeitszeitaufzeichnungen werden 7 Jahre ab Jahresende aufbewahrt (§ 132 BAO). Anmeldecodes (24 h), Anmeldeprotokoll (90 Tage) und Mail-Protokolle (1 Jahr) werden automatisch bereinigt. Der jährliche Löschlauf wird hier mit Vorschau ausgeführt und protokolliert.</p>
      {!p ? (
        <Spinner />
      ) : (
        <div className="text-sm space-y-2">
          <div>
            Stichtag: <strong>{p.cutoffDate}</strong> – davor liegende Daten: {p.oldEntries} Buchungen, {p.oldAbsences} Abwesenheiten, {p.oldAudit} Protokolleinträge.
          </div>
          <div>
            Zu anonymisierende ehemalige Mitarbeiter:innen (Austritt vor Stichtag): {p.formerEmployees.length === 0 ? 'keine' : p.formerEmployees.map((f) => `${f.name} (${f.entries} Buchungen)`).join(', ')}
          </div>
          {nothing ? <p className="text-emerald-700">Aktuell ist nichts zu löschen.</p> : isOwner ? <button className="btn-danger btn-sm" onClick={run} disabled={busy}>{busy ? <Spinner /> : 'Löschlauf ausführen'}</button> : <p className="text-muted">Den Löschlauf können nur Inhaber:innen ausführen.</p>}
          {msg && <p className="text-emerald-700">{msg}</p>}
        </div>
      )}
    </section>
  );
}
