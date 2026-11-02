'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Copy, Plus, Send, Trash2, X } from 'lucide-react';
import { Badge, Field, SeverityBadge, Spinner } from '@/components/ui';
import { fmtDate, fmtH, LOCATION_LABELS, WEEKDAYS_SHORT } from '@/lib/format';
import { addDays } from '@/domain/time';

interface Shift {
  id: string;
  userId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  location: 'office' | 'remote' | 'field';
  projectId: string | null;
  note: string | null;
  status: 'draft' | 'published';
  adopted: boolean;
}
interface Template {
  id: string;
  name: string;
  start: string;
  end: string;
  breakMinutes: number;
  location: 'office' | 'remote' | 'field';
  color: string | null;
}
interface Props {
  monday: string;
  days: string[];
  today: string;
  users: Array<{ id: string; name: string; weeklyMinutes: number; targetMode: string }>;
  shifts: Shift[];
  projects: Array<{ id: string; code: string; name: string; color: string | null }>;
  templates: Template[];
  prevWeekCount: number;
}

function net(s: { start: string; end: string; breakMinutes: number }): number {
  const [sh, sm] = s.start.split(':').map(Number);
  const [eh, em] = s.end.split(':').map(Number);
  let g = eh * 60 + em - (sh * 60 + sm);
  if (g <= 0) g += 1440;
  return Math.max(0, g - s.breakMinutes);
}

export function Planner({ monday, days, today, users, shifts, projects, templates, prevWeekCount }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Shift> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checks, setChecks] = useState<Array<{ userId: string; userName: string; violations: Array<{ code: string; severity: 'error' | 'warn' | 'info'; date: string; message: string; legalRef: string }> }> | null>(null);
  const [newTpl, setNewTpl] = useState<Partial<Template> | null>(null);
  const totals = useMemo(() => Object.fromEntries(users.map((u) => [u.id, shifts.filter((s) => s.userId === u.id).reduce((a, s) => a + net(s), 0)])), [users, shifts]);

  async function post(body: Record<string, unknown>) {
    setBusy(String(body.action));
    setMsg(null);
    const r = await fetch('/api/admin/shifts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      setMsg({ ok: false, text: d.error || 'Fehler' });
      return null;
    }
    return d;
  }
  async function save() {
    if (!editing?.userId || !editing.date || !editing.start || !editing.end) return;
    const d = await post({ action: 'upsert', shift: { id: editing.id, userId: editing.userId, date: editing.date, start: editing.start, end: editing.end, breakMinutes: Number(editing.breakMinutes ?? 30), location: editing.location ?? 'office', projectId: editing.projectId ?? null, note: editing.note ?? null } });
    if (d) {
      setEditing(null);
      router.refresh();
    }
  }
  async function remove(id: string) {
    const d = await post({ action: 'delete', id });
    if (d) {
      setEditing(null);
      router.refresh();
    }
  }
  async function copyPrev() {
    const d = await post({ action: 'copy', fromMonday: addDays(monday, -7), toMonday: monday });
    if (d) {
      setMsg({ ok: true, text: `${d.copied} Schichten aus der Vorwoche übernommen (als Entwurf).` });
      router.refresh();
    }
  }
  async function check() {
    const d = await post({ action: 'check', monday });
    if (d) setChecks(d.checks);
  }
  async function publish(force = false) {
    const d = await post({ action: 'publish', monday, force });
    if (!d) return;
    if (d.published === 0 && d.checks?.some((c: { violations: Array<{ severity: string }> }) => c.violations.some((v) => v.severity === 'error'))) {
      setChecks(d.checks);
      setMsg({ ok: false, text: 'Veröffentlichung gestoppt: Der Plan verletzt gesetzliche Grenzen (siehe Prüfung). Korrigieren oder bewusst „trotzdem veröffentlichen“.' });
      return;
    }
    setMsg({ ok: true, text: `${d.published} Schichten veröffentlicht, Mitarbeiter:innen informiert.` });
    setChecks(null);
    router.refresh();
  }
  async function saveTemplate() {
    if (!newTpl?.name || !newTpl.start || !newTpl.end) return;
    const d = await post({ action: 'template', name: newTpl.name, start: newTpl.start, end: newTpl.end, breakMinutes: Number(newTpl.breakMinutes ?? 30), location: newTpl.location ?? 'office', color: newTpl.color ?? null });
    if (d) {
      setNewTpl(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost btn-sm border border-line" onClick={copyPrev} disabled={busy !== null || prevWeekCount === 0} title={prevWeekCount ? `${prevWeekCount} Schichten in der Vorwoche` : 'Vorwoche leer'}>
          <Copy className="w-4 h-4" /> Vorwoche kopieren
        </button>
        <button className="btn-secondary btn-sm" onClick={check} disabled={busy !== null || shifts.length === 0}>
          {busy === 'check' ? <Spinner /> : 'AZG-Prüfung'}
        </button>
        <button className="btn-primary btn-sm" onClick={() => publish(false)} disabled={busy !== null || !shifts.some((s) => s.status === 'draft')} data-testid="publish-week">
          {busy === 'publish' ? <Spinner /> : <Send className="w-4 h-4" />} Veröffentlichen & informieren
        </button>
        <div className="ml-auto flex flex-wrap gap-1 items-center text-xs">
          <span className="text-muted mr-1">Vorlagen:</span>
          {templates.map((t) => (
            <span key={t.id} className="badge bg-white border border-line gap-1" style={{ borderColor: t.color || undefined }}>
              {t.name} {t.start}–{t.end}
              <button className="text-muted hover:text-red-700" onClick={() => post({ action: 'template_delete', id: t.id }).then(() => router.refresh())} aria-label="Vorlage löschen">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button className="btn-ghost btn-sm" onClick={() => setNewTpl({ name: '', start: '08:00', end: '16:30', breakMinutes: 30, location: 'office' })}>
            + Vorlage
          </button>
        </div>
      </div>
      {msg && <p className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>}

      {checks && (
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">AZG-Prüfung des Plans</h2>
            <button className="btn-ghost btn-sm" onClick={() => setChecks(null)}>
              Schließen
            </button>
          </div>
          {checks.every((c) => c.violations.length === 0) ? (
            <p className="text-sm text-emerald-700 mt-1">Keine Auffälligkeiten – Höchstgrenzen, Pausen und Ruhezeiten eingehalten.</p>
          ) : (
            <ul className="text-sm mt-2 space-y-1">
              {checks
                .filter((c) => c.violations.length)
                .flatMap((c) =>
                  c.violations.map((v, i) => (
                    <li key={c.userId + i} className="flex items-start gap-2">
                      <SeverityBadge severity={v.severity} />
                      <span>
                        <strong>{c.userName}</strong> {fmtDate(v.date, { year: false })}: {v.message} <span className="text-muted">({v.legalRef})</span>
                      </span>
                    </li>
                  )),
                )}
            </ul>
          )}
          {checks.some((c) => c.violations.some((v) => v.severity === 'error')) && (
            <button className="btn-danger btn-sm mt-3" onClick={() => publish(true)} disabled={busy !== null}>
              Trotzdem veröffentlichen (wird protokolliert)
            </button>
          )}
        </section>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th className="w-44">Mitarbeiter:in</th>
              {days.map((d) => (
                <th key={d} className={clsx('text-center', d === today && 'text-brand')}>
                  {WEEKDAYS_SHORT[new Date(d + 'T00:00:00Z').getUTCDay() === 0 ? 6 : new Date(d + 'T00:00:00Z').getUTCDay() - 1]} {d.slice(8)}.{d.slice(5, 7)}.
                </th>
              ))}
              <th className="text-right">Σ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted">
                    Vertrag {fmtH(u.weeklyMinutes)} {u.targetMode === 'plan' ? '· Soll aus Plan' : ''}
                  </div>
                </td>
                {days.map((d) => {
                  const cell = shifts.filter((s) => s.userId === u.id && s.date === d);
                  return (
                    <td key={d} className={clsx('align-top p-1', d < today && 'bg-gray-50/60')}>
                      <div className="space-y-1 min-h-[44px]">
                        {cell.map((s) => (
                          <button key={s.id} onClick={() => setEditing(s)} className={clsx('w-full text-left rounded-lg px-2 py-1 text-xs border', s.status === 'published' ? 'bg-brand-soft border-brand/30 text-brand' : 'bg-amber-50 border-amber-200 text-amber-900')}>
                            <div className="font-semibold tabular-nums">
                              {s.start}–{s.end}
                            </div>
                            <div className="opacity-80">
                              {LOCATION_LABELS[s.location]} · {fmtH(net(s))}
                              {s.adopted ? ' ✓' : ''}
                            </div>
                          </button>
                        ))}
                        <button className="w-full rounded-lg border border-dashed border-line text-muted text-xs py-1 hover:bg-black/5" onClick={() => setEditing({ userId: u.id, date: d, start: templates[0]?.start ?? '08:00', end: templates[0]?.end ?? '16:30', breakMinutes: templates[0]?.breakMinutes ?? 30, location: templates[0]?.location ?? 'office' })} aria-label="Schicht hinzufügen">
                          <Plus className="w-3 h-3 inline" />
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className={clsx('text-right tabular-nums font-medium', totals[u.id] > u.weeklyMinutes ? 'text-amber-700' : '')}>{fmtH(totals[u.id] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        <Badge tone="amber">Entwurf</Badge> nur für Vorgesetzte sichtbar · <Badge tone="brand">veröffentlicht</Badge> Mitarbeiter:innen sehen den Plan in der App und per Mail · ✓ als Ist übernommen. Vor dem Veröffentlichen prüft Zeitly 12 h/60 h, Pausen, 11 h Ruhezeit und Wochenendruhe (AZG §§ 9, 11, 12; ARG § 3).
      </p>

      {editing && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="card w-full sm:max-w-md p-5 rounded-b-none sm:rounded-b-[var(--radius)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                {editing.id ? 'Schicht bearbeiten' : 'Schicht planen'} · {users.find((u) => u.id === editing.userId)?.name}
              </h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditing(null)} aria-label="Schließen">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {templates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {templates.map((t) => (
                    <button key={t.id} className="btn-ghost btn-sm border border-line" onClick={() => setEditing({ ...editing, start: t.start, end: t.end, breakMinutes: t.breakMinutes, location: t.location })}>
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Field label="Datum">
                  <input type="date" className="input" value={editing.date ?? ''} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
                </Field>
                <Field label="Beginn">
                  <input type="time" className="input" value={editing.start ?? ''} onChange={(e) => setEditing({ ...editing, start: e.target.value })} />
                </Field>
                <Field label="Ende">
                  <input type="time" className="input" value={editing.end ?? ''} onChange={(e) => setEditing({ ...editing, end: e.target.value })} />
                </Field>
                <Field label="Pause (min)">
                  <input type="number" className="input" value={editing.breakMinutes ?? 30} onChange={(e) => setEditing({ ...editing, breakMinutes: Number(e.target.value) })} />
                </Field>
                <Field label="Ort">
                  <select className="input" value={editing.location ?? 'office'} onChange={(e) => setEditing({ ...editing, location: e.target.value as Shift['location'] })}>
                    {Object.entries(LOCATION_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Projekt">
                  <select className="input" value={editing.projectId ?? ''} onChange={(e) => setEditing({ ...editing, projectId: e.target.value || null })}>
                    <option value="">–</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Notiz">
                <input className="input" value={editing.note ?? ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="optional, z. B. Messe Wien" />
              </Field>
              <p className="text-xs text-muted">Netto {fmtH(net({ start: editing.start ?? '00:00', end: editing.end ?? '00:00', breakMinutes: Number(editing.breakMinutes ?? 0) }))} · nach dem Speichern ist die Schicht ein Entwurf, bis die Woche veröffentlicht wird.</p>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={save} disabled={busy !== null}>
                  {busy === 'upsert' ? <Spinner /> : 'Speichern'}
                </button>
                {editing.id && (
                  <button className="btn-ghost text-red-700" onClick={() => remove(editing.id!)} disabled={busy !== null}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {newTpl && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-sm p-5 space-y-3">
            <h2 className="font-semibold">Schichtvorlage</h2>
            <Field label="Name">
              <input className="input" value={newTpl.name ?? ''} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} placeholder="z. B. Frühdienst" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Beginn">
                <input type="time" className="input" value={newTpl.start ?? ''} onChange={(e) => setNewTpl({ ...newTpl, start: e.target.value })} />
              </Field>
              <Field label="Ende">
                <input type="time" className="input" value={newTpl.end ?? ''} onChange={(e) => setNewTpl({ ...newTpl, end: e.target.value })} />
              </Field>
              <Field label="Pause">
                <input type="number" className="input" value={newTpl.breakMinutes ?? 30} onChange={(e) => setNewTpl({ ...newTpl, breakMinutes: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Ort">
              <select className="input" value={newTpl.location ?? 'office'} onChange={(e) => setNewTpl({ ...newTpl, location: e.target.value as Shift['location'] })}>
                {Object.entries(LOCATION_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={saveTemplate} disabled={busy !== null}>
                Speichern
              </button>
              <button className="btn-ghost" onClick={() => setNewTpl(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
