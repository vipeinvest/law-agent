'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Spinner } from '@/components/ui';
import { ABSENCE_LABELS } from '@/lib/format';

export function AbsenceForm({ today, userId, onDone }: { today: string; userId?: string; onDone?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ dateFrom: today, dateTo: today, type: 'vacation', halfDay: false, note: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/absences', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...v, note: v.note || null, ...(userId ? { userId } : {}) }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || 'Fehler' });
    setMsg({ ok: true, text: d.absence?.status === 'approved' ? 'Eingetragen.' : 'Antrag gesendet – deine Führungskraft wurde informiert.' });
    setV({ ...v, note: '' });
    router.refresh();
    onDone?.();
  }
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
      <Field label="Art" htmlFor="a-type">
        <select id="a-type" className="input" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
          {Object.entries(ABSENCE_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Von" htmlFor="a-from">
        <input id="a-from" type="date" className="input" value={v.dateFrom} onChange={(e) => setV({ ...v, dateFrom: e.target.value, dateTo: e.target.value > v.dateTo ? e.target.value : v.dateTo })} required />
      </Field>
      <Field label="Bis" htmlFor="a-to">
        <input id="a-to" type="date" className="input" value={v.dateTo} min={v.dateFrom} onChange={(e) => setV({ ...v, dateTo: e.target.value })} required />
      </Field>
      <Field label="Notiz" htmlFor="a-note">
        <input id="a-note" className="input" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="optional" maxLength={500} />
      </Field>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input type="checkbox" checked={v.halfDay} disabled={v.dateFrom !== v.dateTo} onChange={(e) => setV({ ...v, halfDay: e.target.checked })} /> ½ Tag
        </label>
        <button className="btn-primary flex-1" disabled={busy}>
          {busy ? <Spinner /> : v.type === 'sick' ? 'Melden' : 'Beantragen'}
        </button>
      </div>
      {v.type === 'sick' && <p className="sm:col-span-2 lg:col-span-5 text-xs text-muted">Krankenstand wird nur als Tatsache und Dauer erfasst – bitte keine Diagnose in die Notiz schreiben. Die Krankmeldung an den Arbeitgeber und die ärztliche Bestätigung laufen wie bisher.</p>}
      {msg && <p className={`sm:col-span-2 lg:col-span-5 text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}
    </form>
  );
}

export function AbsenceRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost btn-sm text-red-700"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Antrag zurückziehen?')) return;
        setBusy(true);
        await fetch(`/api/absences/${id}`, { method: 'DELETE' });
        setBusy(false);
        router.refresh();
      }}
    >
      Zurückziehen
    </button>
  );
}
