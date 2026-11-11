'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Copy, Euro, Plus, Send, Trash2, X } from 'lucide-react';
import { Badge, Field, SeverityBadge, Spinner } from '@/components/ui';
import { ABSENCE_LABELS, fmtDate, fmtH, LOCATION_LABELS, WEEKDAYS_SHORT } from '@/lib/format';
import { absenceOn, summarizeLaborPlan, type AbsenceLike } from '@/domain/budget';
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
  absences: AbsenceLike[];
  /** amounts are only shown to admin/owner */
  canSeeCost: boolean;
  costs: Record<string, number | null>;
  budgetWeekly: number | null;
}

const eur = (n: number) => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function net(s: { start: string; end: string; breakMinutes: number }): number {
  const [sh, sm] = s.start.split(':').map(Number);
  const [eh, em] = s.end.split(':').map(Number);
  let g = eh * 60 + em - (sh * 60 + sm);
  if (g <= 0) g += 1440;
  return Math.max(0, g - s.breakMinutes);
}

export function Planner({ monday, days, today, users, shifts, projects, templates, prevWeekCount, absences, canSeeCost, costs, budgetWeekly }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Shift> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checks, setChecks] = useState<Array<{ userId: string; userName: string; violations: Array<{ code: string; severity: 'error' | 'warn' | 'info'; date: string; message: string; legalRef: string }> }> | null>(null);
  const [newTpl, setNewTpl] = useState<Partial<Template> | null>(null);
  const totals = useMemo(() => Object.fromEntries(users.map((u) => [u.id, shifts.filter((s) => s.userId === u.id).reduce((a, s) => a + net(s), 0)])), [users, shifts]);
  const labor = useMemo(() => summarizeLaborPlan(shifts, costs, budgetWeekly), [shifts, costs, budgetWeekly]);
  const contractMinutes = useMemo(() => users.reduce((a, u) => a + u.weeklyMinutes, 0), [users]);
  const [budgetInput, setBudgetInput] = useState<string | null>(null);
  async function saveBudget() {
    if (budgetInput === null) return;
    const v = budgetInput.trim() === '' ? null : Number(budgetInput.replace(',', '.'));
    if (v !== null && (!Number.isFinite(v) || v < 0)) return setMsg({ ok: false, text: 'Bitte einen Betrag in Euro eingeben.' });
    setBusy('budget');
    const r = await fetch('/api/admin/org', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ laborBudgetWeekly: v }) });
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: 'Budget konnte nicht gespeichert werden.' });
    setBudgetInput(null);
    router.refresh();
  }

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

      <section className="card p-4" data-testid="labor-summary">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Geplant diese Woche</div>
            <div className="text-xl font-bold tabular-nums">{fmtH(labor.minutes)}</div>
            <div className="text-xs text-muted">Vertragsstunden im Team {fmtH(contractMinutes)}</div>
          </div>
          {canSeeCost && (
            <>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Personalkosten laut Plan</div>
                <div className="text-xl font-bold tabular-nums" data-testid="labor-cost">{eur(labor.cost)}</div>
                <div className="text-xs text-muted">{labor.uncosted.length ? `${labor.uncosted.length} Person(en) ohne Kostensatz nicht enthalten` : 'Stunden mal Kostensatz je Person'}</div>
              </div>
              <div className="min-w-[240px] flex-1">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
                  <span>Wochenbudget</span>
                  {budgetInput === null ? (
                    <button className="normal-case underline" onClick={() => setBudgetInput(labor.budget ? String(labor.budget) : '')} data-testid="budget-edit">
                      {labor.budget ? 'ändern' : 'festlegen'}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 normal-case">
                      <input className="input h-7 w-28 text-sm" inputMode="decimal" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="EUR" aria-label="Wochenbudget in Euro" data-testid="budget-input" />
                      <button className="btn-secondary btn-sm" onClick={saveBudget} disabled={busy !== null} data-testid="budget-save">
                        Speichern
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setBudgetInput(null)} aria-label="Abbrechen">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
                {labor.budget ? (
                  <>
                    <div className="mt-1 h-2.5 rounded-full bg-black/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round((labor.utilization ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className={clsx('h-full rounded-full', labor.status === 'over' ? 'bg-red-600' : labor.status === 'tight' ? 'bg-amber-500' : 'bg-emerald-600')} style={{ width: `${Math.min(100, Math.round((labor.utilization ?? 0) * 100))}%` }} />
                    </div>
                    <div className={clsx('mt-1 text-sm tabular-nums', labor.status === 'over' ? 'text-red-700 font-semibold' : 'text-muted')} data-testid="budget-status">
                      {eur(labor.cost)} von {eur(labor.budget)} · {Math.round((labor.utilization ?? 0) * 100)} % · {labor.status === 'over' ? `${eur(Math.abs(labor.remaining ?? 0))} über Budget` : `${eur(labor.remaining ?? 0)} frei`}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-muted">Noch kein Budget festgelegt. Mit Budget zeigt der Plan sofort, ob die Woche im Rahmen bleibt.</div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

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
                  const abs = absenceOn(absences, u.id, d);
                  return (
                    <td key={d} className={clsx('align-top p-1', d < today && 'bg-gray-50/60', abs && 'bg-sky-50/70')}>
                      <div className="space-y-1 min-h-[44px]">
                        {abs && (
                          <div className={clsx('rounded-lg px-2 py-1 text-xs border', abs.status === 'approved' ? 'bg-sky-100 border-sky-200 text-sky-900' : 'bg-white border-dashed border-sky-300 text-sky-800', cell.length > 0 && abs.status === 'approved' && 'ring-2 ring-red-400')} data-testid="plan-absence" title={cell.length > 0 && abs.status === 'approved' ? 'Schicht trotz genehmigter Abwesenheit geplant' : undefined}>
                            <span className="font-semibold">{ABSENCE_LABELS[abs.type] ?? abs.type}</span>
                            {abs.halfDay ? ' (½)' : ''}
                            {abs.status === 'requested' ? ' · beantragt' : ''}
                          </div>
                        )}
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
                <td className={clsx('text-right tabular-nums font-medium', totals[u.id] > u.weeklyMinutes ? 'text-amber-700' : '')}>
                  {fmtH(totals[u.id] ?? 0)}
                  {canSeeCost && (totals[u.id] ?? 0) > 0 && <div className="text-xs font-normal text-muted">{labor.perUser[u.id]?.cost != null ? eur(labor.perUser[u.id].cost as number) : 'kein Satz'}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        <Euro className="w-3 h-3 inline" /> Kosten und Budget sehen nur Admin und Inhaber, der Kostensatz steht in den Stammdaten der Person. Abwesenheiten erscheinen blau im Plan. <Badge tone="amber">Entwurf</Badge> nur für Vorgesetzte sichtbar · <Badge tone="brand">veröffentlicht</Badge> Mitarbeiter:innen sehen den Plan in der App und per Mail · ✓ als Ist übernommen. Vor dem Veröffentlichen prüft Fairhours 12 h/60 h, Pausen, 11 h Ruhezeit und Wochenendruhe (AZG §§ 9, 11, 12; ARG § 3).
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
