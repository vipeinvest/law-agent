'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Spinner } from '@/components/ui';

interface Sheet {
  sheet: string;
  headers: string[];
  rows: string[][];
  total: number;
}
interface Parsed {
  filename: string;
  sheets: Sheet[];
  users: Array<{ id: string; name: string; email: string; personnelNo: string | null }>;
}
type Mapping = { sheet: string; date: number; start: number | null; end: number | null; breakMinutes: number | null; duration: number | null; employee: number | null; note: number | null; project: number | null; defaultUserId: string | null; defaultLocation: 'office' | 'remote' | 'field' };

function guess(headers: string[], ...needles: string[]): number | null {
  const i = headers.findIndex((h) => needles.some((n) => h.toLowerCase().includes(n)));
  return i >= 0 ? i : null;
}

export function ImportWizard() {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ dryRun: boolean; ok?: number; imported?: number; errors: Array<{ row: number; error: string }>; sample?: Array<Record<string, unknown>> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheet = useMemo(() => parsed?.sheets.find((s) => s.sheet === mapping?.sheet) ?? parsed?.sheets[0], [parsed, mapping]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/import', { method: 'POST', body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || 'Datei konnte nicht gelesen werden.');
    setParsed(d);
    const h = d.sheets[0].headers as string[];
    setMapping({ sheet: d.sheets[0].sheet, date: guess(h, 'datum', 'date', 'tag') ?? 0, start: guess(h, 'beginn', 'von', 'start', 'kommen'), end: guess(h, 'ende', 'bis', 'end', 'gehen'), breakMinutes: guess(h, 'pause'), duration: guess(h, 'dauer', 'stunden', 'netto', 'summe'), employee: guess(h, 'mitarbeiter', 'name', 'person', 'email', 'e-mail'), note: guess(h, 'notiz', 'bemerk', 'tätigkeit', 'kommentar', 'beschreib'), project: guess(h, 'projekt', 'kostenstelle', 'kunde', 'auftrag'), defaultUserId: null, defaultLocation: 'office' });
  }

  async function run(dryRun: boolean) {
    if (!parsed || !mapping || !sheet) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: parsed.filename, mapping: { ...mapping, dryRun }, rows: sheet.rows }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || 'Fehler');
    setResult(d);
    if (!dryRun) router.refresh();
  }

  const colSelect = (key: keyof Mapping, label: string, hint?: string) =>
    sheet && mapping ? (
      <Field label={label} hint={hint}>
        <select className="input" value={(mapping[key] as number | null) ?? ''} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">– nicht vorhanden –</option>
          {sheet.headers.map((h, i) => (
            <option key={i} value={i}>
              {h}
            </option>
          ))}
        </select>
      </Field>
    ) : null;

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-2">1. Datei wählen</h2>
        <p className="text-sm text-muted mb-3">Excel (.xlsx) oder CSV. Eine Zeile pro Tag oder pro Buchung. Datum wird in den Formaten 02.11.2026, 2026-11-02 und Excel-Datum erkannt; Zeiten als 08:30, Dauer als 7:30 oder 7,5.</p>
        <input type="file" accept=".xlsx,.csv" className="input pt-2" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={busy} />
        {busy && !parsed && <Spinner className="mt-2" />}
        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
      </section>

      {parsed && mapping && sheet && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-semibold mb-2">2. Spalten zuordnen</h2>
          <p className="text-sm text-muted mb-3">
            {parsed.filename} · {sheet.total} Datenzeilen
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {parsed.sheets.length > 1 && (
              <Field label="Tabellenblatt">
                <select className="input" value={mapping.sheet} onChange={(e) => setMapping({ ...mapping, sheet: e.target.value })}>
                  {parsed.sheets.map((s) => (
                    <option key={s.sheet} value={s.sheet}>
                      {s.sheet} ({s.total})
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {colSelect('date', 'Datum *')}
            {colSelect('start', 'Beginn')}
            {colSelect('end', 'Ende')}
            {colSelect('breakMinutes', 'Pause (min oder h:mm)')}
            {colSelect('duration', 'Dauer (wenn kein Beginn/Ende)')}
            {colSelect('employee', 'Mitarbeiter:in (Name, E-Mail oder Personalnr)')}
            {mapping.employee == null && (
              <Field label="Alle Zeilen gehören zu">
                <select className="input" value={mapping.defaultUserId ?? ''} onChange={(e) => setMapping({ ...mapping, defaultUserId: e.target.value || null })}>
                  <option value="">– bitte wählen –</option>
                  {parsed.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {colSelect('project', 'Projekt (Kürzel oder Name)')}
            {colSelect('note', 'Notiz / Tätigkeit')}
            <Field label="Arbeitsort für alle Zeilen">
              <select className="input" value={mapping.defaultLocation} onChange={(e) => setMapping({ ...mapping, defaultLocation: e.target.value as Mapping['defaultLocation'] })}>
                <option value="office">Büro</option>
                <option value="remote">Telearbeit</option>
                <option value="field">Außendienst</option>
              </select>
            </Field>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="table text-xs">
              <thead>
                <tr>
                  {sheet.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {sheet.headers.map((_, j) => (
                      <td key={j}>{r[j]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-secondary btn-sm" onClick={() => run(true)} disabled={busy || (mapping.employee == null && !mapping.defaultUserId)}>
              {busy ? <Spinner /> : '3. Prüfen (Vorschau)'}
            </button>
            <button className="btn-primary btn-sm" onClick={() => run(false)} disabled={busy || !result?.dryRun || (result?.ok ?? 0) === 0}>
              4. Importieren
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-semibold mb-2">{result.dryRun ? 'Vorschau' : 'Ergebnis'}</h2>
          <p className="text-sm">
            {result.dryRun ? `${result.ok} Zeilen importierbar` : `${result.imported} Buchungen importiert`}
            {result.errors.length > 0 && <span className="text-amber-800"> · {result.errors.length} Zeilen mit Problemen (werden übersprungen)</span>}
          </p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-muted mt-2 max-h-40 overflow-auto list-disc pl-4">
              {result.errors.slice(0, 50).map((e, i) => (
                <li key={i}>
                  Zeile {e.row}: {e.error}
                </li>
              ))}
            </ul>
          )}
          {result.sample && result.sample.length > 0 && (
            <div className="overflow-x-auto mt-3">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>Zeile</th>
                    <th>Mitarbeiter</th>
                    <th>Datum</th>
                    <th>Beginn</th>
                    <th>Ende</th>
                    <th>Pause</th>
                    <th>Dauer</th>
                    <th>Notiz</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sample.map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.row)}</td>
                      <td>{String(r.userName)}</td>
                      <td>{String(r.date)}</td>
                      <td>{String(r.start ?? '')}</td>
                      <td>{String(r.end ?? '')}</td>
                      <td>{String(r.breakMinutes ?? '')}</td>
                      <td>{r.durationMinutes != null ? `${Math.floor(Number(r.durationMinutes) / 60)}:${String(Number(r.durationMinutes) % 60).padStart(2, '0')}` : ''}</td>
                      <td>{String(r.note ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
