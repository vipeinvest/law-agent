'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Spinner } from '@/components/ui';
import { ROLE_LABELS, WEEKDAYS_SHORT } from '@/lib/format';
import type { Employment, Role } from '@/domain/types';

export interface EmployeeFormValue {
  id?: string;
  email: string;
  name: string;
  role: Role;
  personnelNo: string;
  managerId: string;
  active: boolean;
  employment: Employment;
}

export function EmployeeForm({ initial, managers, isOwner, selfId }: { initial: EmployeeFormValue; managers: Array<{ id: string; name: string }>; isOwner: boolean; selfId: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [sendInvite, setSendInvite] = useState(true);
  const [sendOnboarding, setSendOnboarding] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const emp = v.employment;
  const setEmp = (patch: Partial<Employment>) => setV({ ...v, employment: { ...emp, ...patch } });
  const weeklyHours = (emp.weeklyMinutes / 60).toString().replace('.', ',');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const body = { ...(v.id ? { id: v.id, active: v.active } : { sendInvite, sendOnboarding }), email: v.email, name: v.name, role: v.role, personnelNo: v.personnelNo || null, managerId: v.managerId || null, employment: { ...emp, startDate: emp.startDate || null, endDate: emp.endDate || null } };
    const res = await fetch('/api/admin/users', { method: v.id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || 'Fehler' });
    setMsg({ ok: true, text: v.id ? 'Gespeichert.' : 'Angelegt' + (sendInvite ? ' und Einladung gesendet.' : '.') });
    if (!v.id) router.push(`/admin/mitarbeiter/${d.user.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-3">Person</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name" htmlFor="e-name">
            <input id="e-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
          </Field>
          <Field label="Dienstliche E-Mail (Login)" htmlFor="e-email">
            <input id="e-email" type="email" className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
          </Field>
          <Field label="Rolle" htmlFor="e-role" hint="Mitarbeiter sehen nur eigene Zeiten. Vorgesetzte ihr Team. Lohnverrechnung nur Exporte.">
            <select id="e-role" className="input" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })} disabled={v.id === selfId}>
              {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'owner' || isOwner || v.role === 'owner').map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personalnummer" htmlFor="e-pn" hint="Für den Lohn-Export">
            <input id="e-pn" className="input" value={v.personnelNo} onChange={(e) => setV({ ...v, personnelNo: e.target.value })} />
          </Field>
          <Field label="Vorgesetzte:r" htmlFor="e-mgr">
            <select id="e-mgr" className="input" value={v.managerId} onChange={(e) => setV({ ...v, managerId: e.target.value })}>
              <option value="">– keine Zuordnung –</option>
              {managers
                .filter((m) => m.id !== v.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          {v.id && v.id !== selfId && (
            <Field label="Status">
              <label className="flex items-center gap-2 h-11 text-sm">
                <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> aktiv (deaktivierte Konten können sich nicht anmelden; Daten bleiben erhalten)
              </label>
            </Field>
          )}
        </div>
      </section>

      {v.role !== 'payroll' && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-semibold mb-3">Arbeitszeitmodell</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Wochenstunden laut Vertrag" htmlFor="e-wh" hint="z. B. 38,5 oder 20">
              <input id="e-wh" className="input" inputMode="decimal" defaultValue={weeklyHours} onBlur={(e) => setEmp({ weeklyMinutes: Math.round(Number(e.target.value.replace(',', '.')) * 60) || 0 })} />
            </Field>
            <Field label="Arbeitstage">
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button type="button" key={d} className={`btn btn-sm ${emp.workDays.includes(d) ? 'btn-secondary' : 'btn-ghost border border-line'}`} onClick={() => setEmp({ workDays: emp.workDays.includes(d) ? emp.workDays.filter((x) => x !== d) : [...emp.workDays, d].sort() })}>
                    {WEEKDAYS_SHORT[d - 1]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Erfassungsart" htmlFor="e-rm" hint="„Nur Dauer“ nur bei weitgehend selbstbestimmter Arbeitszeit/Arbeitsort (§ 26 Abs 3 AZG).">
              <select id="e-rm" className="input" value={emp.recordMode} onChange={(e) => setEmp({ recordMode: e.target.value as Employment['recordMode'] })}>
                <option value="full">Beginn, Ende, Pausen</option>
                <option value="duration_only">Nur Dauer der Tagesarbeitszeit</option>
              </select>
            </Field>
            <Field label="Kostensatz je Stunde (EUR)" htmlFor="e-cost" hint="Inklusive Lohnnebenkosten. Grundlage für das Personalkosten-Budget im Dienstplan, nur für Admin und Inhaber sichtbar.">
              <input id="e-cost" type="number" step="0.01" min="0" className="input" value={emp.hourlyCost ?? ''} onChange={(e) => setEmp({ hourlyCost: e.target.value === '' ? null : Number(e.target.value) })} placeholder="z. B. 28,50" />
            </Field>
            <Field label="Urlaubsanspruch (Arbeitstage/Jahr)" htmlFor="e-vac">
              <input id="e-vac" type="number" step="0.5" className="input" value={emp.vacationDaysPerYear} onChange={(e) => setEmp({ vacationDaysPerYear: Number(e.target.value) })} />
            </Field>
            <Field label="Eintritt" htmlFor="e-start">
              <input id="e-start" type="date" className="input" value={emp.startDate ?? ''} onChange={(e) => setEmp({ startDate: e.target.value || undefined })} />
            </Field>
            <Field label="Austritt (optional)" htmlFor="e-end">
              <input id="e-end" type="date" className="input" value={emp.endDate ?? ''} onChange={(e) => setEmp({ endDate: e.target.value || null })} />
            </Field>
            <Field label="Zeitkonto-Startsaldo (Stunden)" htmlFor="e-ob" hint="Übertrag aus dem bisherigen System, z. B. 12,5 oder -3">
              <input id="e-ob" className="input" inputMode="decimal" defaultValue={(emp.openingBalanceMinutes / 60).toString().replace('.', ',')} onBlur={(e) => setEmp({ openingBalanceMinutes: Math.round(Number(e.target.value.replace(',', '.')) * 60) || 0 })} />
            </Field>
            <div className="space-y-2 text-sm pt-6">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={emp.gleitzeit} onChange={(e) => setEmp({ gleitzeit: e.target.checked })} /> Gleitzeitvereinbarung (§ 4b AZG, Normalarbeitszeit bis 10 h)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={emp.allIn} onChange={(e) => setEmp({ allIn: e.target.checked })} /> All-in / Überstundenpauschale (ÜSt werden ausgewiesen, als abgegolten markiert)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!emp.teleworkAgreement} onChange={(e) => setEmp({ teleworkAgreement: e.target.checked })} /> Schriftliche Telearbeitsvereinbarung liegt vor (§ 2h AVRAG)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!emp.azgExempt} onChange={(e) => setEmp({ azgExempt: e.target.checked })} /> Vom AZG ausgenommen (leitende Angestellte, § 1 Abs 2 Z 8) – keine Grenzwertprüfung
              </label>
              <div className="pt-2 border-t border-line mt-2">
                <div className="font-medium mb-1">Dienstplan</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={emp.targetMode === 'plan'} onChange={(e) => setEmp({ targetMode: e.target.checked ? 'plan' : 'contract' })} /> Soll-Zeit aus veröffentlichtem Dienstplan (statt Vertragsmuster) – für Teilzeit mit wechselnden Tagen
                </label>
                <label className="flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={!!emp.autoAdoptPlan} onChange={(e) => setEmp({ autoAdoptPlan: e.target.checked })} /> Geplante Schichten nachts automatisch als Ist übernehmen, wenn nichts gebucht wurde (Negativzeiterfassung; Korrektur durch MA bleibt möglich)
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {!v.id && (
        <div className="space-y-1 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={sendOnboarding} onChange={(e) => setSendOnboarding(e.target.checked)} />
            <span>
              <strong>Onboarding-Fragebogen senden</strong> (empfohlen): Die Person ergänzt Stammdaten für ÖGK-Anmeldung und Lohnverrechnung selbst – per Foto von Ausweis/e-card/Meldezettel, Spracheingabe, Dokumenten-Upload. Nach dem Absenden erhält sie automatisch ihren Zugang zur Zeiterfassung.
            </span>
          </label>
          {!sendOnboarding && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} /> Nur Einladungs-E-Mail mit Login-Anleitung senden
            </label>
          )}
        </div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? <Spinner /> : v.id ? 'Speichern' : 'Anlegen'}
      </button>
    </form>
  );
}
