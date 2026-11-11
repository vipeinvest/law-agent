'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Field, Spinner } from '@/components/ui';
import { LOCATION_LABELS, TYPE_LABELS } from '@/lib/format';

export interface EntryFormValue {
  id?: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  durationMinutes: number | null;
  type: 'work' | 'travel' | 'oncall';
  location: 'office' | 'remote' | 'field';
  projectId: string | null;
  note: string;
}

export function EntryForm({
  initial,
  projects,
  recordMode,
  userId,
  onClose,
}: {
  initial: EntryFormValue;
  projects: Array<{ id: string; code: string; name: string }>;
  recordMode: 'full' | 'duration_only';
  userId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<EntryFormValue>(initial);
  const [mode, setMode] = useState<'times' | 'duration'>(recordMode === 'duration_only' || (!initial.start && initial.durationMinutes != null) ? 'duration' : 'times');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationText, setDurationText] = useState(initial.durationMinutes != null ? `${Math.floor(initial.durationMinutes / 60)}:${String(initial.durationMinutes % 60).padStart(2, '0')}` : '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let durationMinutes: number | null = null;
    if (mode === 'duration') {
      const [h, m] = durationText.split(':').map(Number);
      durationMinutes = Number.isFinite(m) ? h * 60 + m : Math.round(Number(durationText.replace(',', '.')) * 60);
      if (!durationMinutes || durationMinutes <= 0) {
        setBusy(false);
        return setError('Bitte eine Dauer angeben (z. B. 7:30).');
      }
    }
    const payload = {
      date: v.date,
      start: mode === 'times' ? v.start || null : null,
      end: mode === 'times' ? v.end || null : null,
      breakMinutes: mode === 'times' ? Number(v.breakMinutes) || 0 : 0,
      durationMinutes,
      type: v.type,
      location: v.location,
      projectId: v.projectId || null,
      note: v.note || null,
      ...(userId ? { userId } : {}),
    };
    const res = await fetch(v.id ? `/api/entries/${v.id}` : '/api/entries', { method: v.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || 'Speichern fehlgeschlagen.');
    }
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!v.id || !confirm('Buchung wirklich löschen?')) return;
    setBusy(true);
    const res = await fetch(`/api/entries/${v.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Löschen fehlgeschlagen.');
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="card w-full sm:max-w-md p-5 rounded-b-none sm:rounded-b-[var(--radius)] max-h-[92dvh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">{v.id ? 'Buchung bearbeiten' : 'Buchung nachtragen'}</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Datum" htmlFor="f-date">
            <input id="f-date" type="date" className="input" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} required />
          </Field>
          {recordMode === 'full' && (
            <div className="flex gap-1 text-sm">
              <button type="button" className={`tab ${mode === 'times' ? 'tab-active' : ''}`} onClick={() => setMode('times')}>
                Von / Bis
              </button>
              <button type="button" className={`tab ${mode === 'duration' ? 'tab-active' : ''}`} onClick={() => setMode('duration')}>
                Nur Dauer
              </button>
            </div>
          )}
          {mode === 'times' ? (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Beginn" htmlFor="f-start">
                <input id="f-start" type="time" className="input" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} required />
              </Field>
              <Field label="Ende" htmlFor="f-end">
                <input id="f-end" type="time" className="input" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} required />
              </Field>
              <Field label="Pause (min)" htmlFor="f-break">
                <input id="f-break" type="number" min={0} step={5} className="input" value={v.breakMinutes} onChange={(e) => setV({ ...v, breakMinutes: Number(e.target.value) })} />
              </Field>
            </div>
          ) : (
            <Field label="Dauer (h:mm)" htmlFor="f-dur" hint="Nur Dauer erfassen ist zulässig, wenn Lage der Arbeitszeit und Arbeitsort weitgehend selbst bestimmt werden (§ 26 Abs 3 AZG).">
              <input id="f-dur" className="input" placeholder="7:30" value={durationText} onChange={(e) => setDurationText(e.target.value)} inputMode="numeric" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Art" htmlFor="f-type">
              <select id="f-type" className="input" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as EntryFormValue['type'] })}>
                {Object.entries(TYPE_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ort" htmlFor="f-loc">
              <select id="f-loc" className="input" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value as EntryFormValue['location'] })}>
                {Object.entries(LOCATION_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Projekt / Kostenstelle" htmlFor="f-proj">
            <select id="f-proj" className="input" value={v.projectId ?? ''} onChange={(e) => setV({ ...v, projectId: e.target.value || null })}>
              <option value="">Kein Projekt</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} – {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notiz" htmlFor="f-note">
            <input id="f-note" className="input" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={500} placeholder="optional" />
          </Field>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button className="btn-primary flex-1" disabled={busy}>
              {busy ? <Spinner /> : 'Speichern'}
            </button>
            {v.id && (
              <button type="button" className="btn-ghost text-red-700" onClick={remove} disabled={busy}>
                Löschen
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
