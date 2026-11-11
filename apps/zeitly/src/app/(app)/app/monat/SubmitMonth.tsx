'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';

export function SubmitMonth({ year, month, monthOver, hasBlocking, errorCount }: { year: number; month: number; monthOver: boolean; hasBlocking: boolean; errorCount: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/periods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit', year, month, note: note || null }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Fehler');
    router.refresh();
  }
  return (
    <section className="card p-4 border-brand/30">
      <h2 className="font-semibold">Monat abschließen</h2>
      {!monthOver ? (
        <p className="text-sm text-muted mt-1">Der Monat kann nach seinem letzten Tag eingereicht werden. Prüfe bis dahin deine Buchungen.</p>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-muted">Mit dem Einreichen bestätigst du die Richtigkeit deiner Arbeitszeitaufzeichnungen (§ 26 Abs 2 AZG). Danach kann nur noch deine Führungskraft korrigieren.</p>
          {errorCount > 0 && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-2">Es gibt {errorCount} Auffälligkeit(en). Du kannst trotzdem einreichen; sie werden deiner Führungskraft angezeigt. Ergänze unten gern eine Erklärung.</p>}
          <textarea className="input" placeholder="Anmerkung für die Führungskraft (optional), z. B. Grund für Überstunden" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>Ich bestätige, dass die Aufzeichnungen vollständig und richtig sind.</span>
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary" onClick={submit} disabled={!confirm || busy || hasBlocking} data-testid="submit-month">
            {busy ? <Spinner /> : 'Monat einreichen'}
          </button>
          {hasBlocking && <p className="text-xs text-red-700">Offene oder überlappende Buchungen müssen zuerst korrigiert werden.</p>}
        </div>
      )}
    </section>
  );
}
