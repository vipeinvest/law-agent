'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Mail } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { MONTHS } from '@/lib/format';

export function ExportPanel({ year, month, payrollEmail, employees }: { year: number; month: number; payrollEmail: string | null; employees: Array<{ id: string; name: string; status: string }> }) {
  const router = useRouter();
  const [to, setTo] = useState(payrollEmail ?? '');
  const [opts, setOpts] = useState({ includeJournals: true, includeProjects: false, markExported: true });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);
  const q = `year=${year}&month=${month}`;
  const notApproved = employees.filter((e) => e.status !== 'approved' && e.status !== 'exported').length;

  async function send() {
    if (!confirm(`Export für ${MONTHS[month - 1]} ${year} an ${to} senden?`)) return;
    setBusy(true);
    setRes(null);
    const r = await fetch('/api/export/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ year, month, to, ...opts, message: message || undefined }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setRes({ ok: false, text: d.error || 'Fehler' });
    setRes({ ok: true, text: `Gesendet an ${d.to} (${d.attachments.join(', ')}).${d.exported ? ` ${d.exported} Monat(e) als exportiert markiert.` : ''}${d.preview ? ' (Demo: Mail nur protokolliert)' : ''}` });
    router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Dateien herunterladen</h2>
          <form className="flex items-center gap-1" action="/admin/export">
            <input type="month" name="m" className="input btn-sm" defaultValue={`${year}-${String(month).padStart(2, '0')}`} />
            <button className="btn-ghost btn-sm">Wechseln</button>
          </form>
        </div>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Lohnverrechnung (Excel)</div>
              <div className="text-xs text-muted">Übersicht je Person, Lohnarten-Import, Tage, Buchungen</div>
            </div>
            <a className="btn-secondary btn-sm" href={`/api/export/payroll?${q}&format=xlsx`}>
              <Download className="w-4 h-4" /> XLSX
            </a>
          </li>
          <li className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Lohnarten (CSV)</div>
              <div className="text-xs text-muted">Langformat, Semikolon, für Import in LV-Systeme</div>
            </div>
            <a className="btn-secondary btn-sm" href={`/api/export/payroll?${q}&format=csv`}>
              <Download className="w-4 h-4" /> CSV
            </a>
          </li>
          <li className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Arbeitszeitnachweise (PDF)</div>
              <div className="text-xs text-muted">Ein PDF, alle Mitarbeiter:innen, § 26 AZG, mit Unterschriftsfeldern</div>
            </div>
            <a className="btn-secondary btn-sm" href={`/api/export/journal?${q}&all=1`}>
              <Download className="w-4 h-4" /> PDF
            </a>
          </li>
          <li className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">Projekte & Kostenstellen (Excel)</div>
              <div className="text-xs text-muted">Stunden je Projekt, Projekt × Mitarbeiter, Arbeitsorte</div>
            </div>
            <a className="btn-secondary btn-sm" href={`/api/export/payroll?${q}&format=projects`}>
              <Download className="w-4 h-4" /> XLSX
            </a>
          </li>
        </ul>
      </section>
      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-1">An die Lohnverrechnung senden</h2>
        <p className="text-sm text-muted mb-3">Versendet Excel + PDF per E-Mail und markiert freigegebene Monate als exportiert.</p>
        {notApproved > 0 && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-2 mb-3">{notApproved} Monat(e) noch nicht freigegeben – Werte können sich noch ändern. Empfehlung: zuerst unter „Freigaben“ prüfen.</p>}
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="x-to">
              Empfänger
            </label>
            <input id="x-to" type="email" className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="lohn@steuerberatung.at" />
          </div>
          <textarea className="input" placeholder="Nachricht (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={opts.includeJournals} onChange={(e) => setOpts({ ...opts, includeJournals: e.target.checked })} /> PDF-Nachweise beilegen
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={opts.includeProjects} onChange={(e) => setOpts({ ...opts, includeProjects: e.target.checked })} /> Projektauswertung beilegen (Buchhaltung)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={opts.markExported} onChange={(e) => setOpts({ ...opts, markExported: e.target.checked })} /> Freigegebene Monate als „exportiert“ markieren
            </label>
          </div>
          {res && <p className={`text-sm ${res.ok ? 'text-emerald-700' : 'text-red-700'}`}>{res.text}</p>}
          <button className="btn-primary" onClick={send} disabled={busy || !to}>
            {busy ? <Spinner /> : <Mail className="w-4 h-4" />} Jetzt senden
          </button>
        </div>
      </section>
    </div>
  );
}
