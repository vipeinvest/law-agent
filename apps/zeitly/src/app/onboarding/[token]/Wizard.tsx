'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, FileText, Mic, MicOff, Sparkles, Trash2, Upload } from 'lucide-react';
import clsx from 'clsx';
import { Field, Spinner } from '@/components/ui';
import { DOC_KINDS, DOC_LABELS, needsWorkPermit, validateIban, validateSvNumber, type DocKind } from '@/domain/onboarding';

type Data = Record<string, Record<string, unknown>>;
interface Ctx {
  status: string;
  expiresAt: string;
  org: { name: string; appName: string; privacyUrl: string };
  user: { name: string; email: string; employment: Record<string, unknown> };
  data: Data;
  completeness: number;
  validation: Array<{ field: string; severity: 'error' | 'warn' | 'info'; message: string }>;
  files: Array<{ id: string; kind: DocKind; filename: string; mime: string; size: number; createdAt: string }>;
  ai: boolean;
}

const STEPS = [
  { key: 'person', label: 'Person' },
  { key: 'contact', label: 'Kontakt' },
  { key: 'docs', label: 'Dokumente' },
  { key: 'bank', label: 'Bank' },
  { key: 'tax', label: 'Steuer & Familie' },
  { key: 'employment', label: 'Beschäftigung' },
  { key: 'consents', label: 'Bestätigung' },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

/** Web Speech API dictation (Chrome/Edge/Safari). Returns null when unsupported. */
function useDictation() {
  const recRef = useRef<any>(null);
  const [active, setActive] = useState<string | null>(null);
  const supported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const start = useCallback(
    (fieldId: string, onText: (t: string) => void, mode: 'text' | 'digits' | 'iban' = 'text') => {
      if (!supported) return;
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new Ctor();
      rec.lang = 'de-AT';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev: any) => {
        let t: string = ev.results[0][0].transcript || '';
        if (mode === 'digits') t = t.replace(/\D/g, '');
        if (mode === 'iban') t = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
        onText(t.trim());
      };
      rec.onend = () => setActive(null);
      rec.onerror = () => setActive(null);
      recRef.current = rec;
      setActive(fieldId);
      rec.start();
    },
    [supported],
  );
  const stop = useCallback(() => {
    recRef.current?.stop();
    setActive(null);
  }, []);
  return { supported, active, start, stop };
}

export function OnboardingWizard({ token }: { token: string }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [step, setStep] = useState<StepKey>('person');
  const [data, setData] = useState<Data>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [suggested, setSuggested] = useState<Record<string, true>>({});
  const [consents, setConsents] = useState({ privacyInfoRead: false, timeTrackingConsent: false, dataCorrect: false });
  const dict = useDictation();
  const base = `/api/onboarding/${token}`;

  useEffect(() => {
    fetch(base)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Fehler');
        return r.json();
      })
      .then((c: Ctx) => {
        setCtx(c);
        const d: Data = { person: {}, contact: { country: 'Österreich' }, bank: {}, tax: { children: [], avabRequested: false, pendlerrechnerDone: false, otherEmployment: false }, employment: { firstJobInAustria: false }, ...c.data };
        // prefill from the user record
        const [first, ...rest] = (c.user.name || '').split(' ');
        d.person.firstName ??= first;
        d.person.lastName ??= rest.join(' ');
        const emp = c.user.employment || {};
        d.employment.startDate ??= emp.startDate;
        d.employment.weeklyHours ??= emp.weeklyMinutes ? Number(emp.weeklyMinutes) / 60 : undefined;
        setData(d);
        if (c.status === 'submitted' || c.status === 'reviewed') setDone(true);
      })
      .catch((e) => setError(e.message));
  }, [base]);

  const set = (group: string, key: string, value: unknown) => {
    setData((d) => ({ ...d, [group]: { ...(d[group] || {}), [key]: value } }));
    setSuggested((s) => {
      const n = { ...s };
      delete n[`${group}.${key}`];
      return n;
    });
  };
  const val = (group: string, key: string): any => data[group]?.[key] ?? '';

  async function persist(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }) });
    setSaving(false);
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error || 'Speichern fehlgeschlagen');
      return false;
    }
    const j = await r.json();
    setCtx((c) => (c ? { ...c, completeness: j.completeness, validation: j.validation } : c));
    return true;
  }

  const idx = STEPS.findIndex((s) => s.key === step);
  async function next() {
    if (!(await persist())) return;
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  function prev() {
    if (idx > 0) setStep(STEPS[idx - 1].key);
  }

  async function upload(kind: DocKind, file: File) {
    setSaving(true);
    setError(null);
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', blob, file.name || `${kind}.jpg`);
      const r = await fetch(`${base}/file`, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Upload fehlgeschlagen');
      setCtx((c) => (c ? { ...c, files: [...c.files, j.file] } : c));
      if (j.suggestions && Object.keys(j.suggestions).length) {
        setData((d) => {
          const n = { ...d };
          const marks: Record<string, true> = {};
          for (const [g, fields] of Object.entries(j.suggestions as Data)) {
            n[g] = { ...(n[g] || {}) };
            for (const [k, v] of Object.entries(fields)) {
              if (n[g][k] === undefined || n[g][k] === '' || n[g][k] === null) {
                n[g][k] = v;
                marks[`${g}.${k}`] = true;
              }
            }
          }
          setSuggested((s) => ({ ...s, ...marks }));
          return n;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }
  async function removeFile(id: string) {
    await fetch(`${base}/file?id=${id}`, { method: 'DELETE' });
    setCtx((c) => (c ? { ...c, files: c.files.filter((f) => f.id !== id) } : c));
  }

  async function submit() {
    if (!(await persist())) return;
    setSaving(true);
    setError(null);
    const r = await fetch(base, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consents }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      const details = j.details?.issues?.map((i: { message: string }) => i.message).join(' ') || (j.details?.fieldErrors ? Object.entries(j.details.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : '');
      return setError(`${j.error || 'Absenden fehlgeschlagen'}${details ? ' – ' + details : ''}`);
    }
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  const svCheck = useMemo(() => (data.person?.svNumber ? validateSvNumber(String(data.person.svNumber)) : null), [data]);
  const ibanCheck = useMemo(() => (data.bank?.iban ? validateIban(String(data.bank.iban)) : null), [data]);
  const permit = needsWorkPermit(String(val('person', 'nationality') || ''));

  if (error && !ctx) return <div className="card p-6 text-center text-red-700">{error}</div>;
  if (!ctx) return <div className="card p-6 text-center"><Spinner /></div>;

  if (done)
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
          <Check className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold">Danke, {ctx.user.name.split(' ')[0]}!</h1>
        <p className="text-sm text-muted mt-2">Deine Angaben sind bei {ctx.org.name} eingegangen. Du bekommst in Kürze eine E-Mail mit deinem Zugang zur Zeiterfassung {ctx.org.appName}. Falls noch etwas fehlt, meldet sich die Personalverwaltung bei dir.</p>
        <a href={`/login`} className="btn-primary mt-5">
          Zur Zeiterfassung anmelden
        </a>
      </div>
    );

  const renderInput = ({ group, k, label, type = 'text', hint, placeholder, inputMode, mode, required }: { group: string; k: string; label: string; type?: string; hint?: ReactNode; placeholder?: string; inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal'; mode?: 'text' | 'digits' | 'iban'; required?: boolean }) => {
    const id = `${group}.${k}`;
    const isSug = !!suggested[id];
    return (
      <Field label={label + (required ? ' *' : '')} htmlFor={id} hint={isSug ? <span className="text-brand inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> aus Dokument übernommen – bitte prüfen</span> : hint}>
        <div className="flex gap-1">
          <input id={id} type={type} inputMode={inputMode} className={clsx('input', isSug && 'ring-2 ring-brand/40')} value={val(group, k)} placeholder={placeholder} onChange={(e) => set(group, k, type === 'number' ? e.target.value : e.target.value)} />
          {dict.supported && type !== 'date' && (
            <button type="button" aria-label="Diktieren" className={clsx('btn btn-sm border border-line shrink-0', dict.active === id ? 'bg-red-600 text-white' : 'btn-ghost')} onClick={() => (dict.active === id ? dict.stop() : dict.start(id, (t) => set(group, k, mode === 'text' && val(group, k) ? `${val(group, k)} ${t}` : t), mode))}>
              {dict.active === id ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
      </Field>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Willkommen, {ctx.user.name.split(' ')[0]}</h1>
        <p className="text-sm text-muted">Ein paar Angaben für deine Anmeldung bei der Sozialversicherung und die Lohnverrechnung. Du kannst Dokumente fotografieren{ctx.ai ? ', wir lesen die Daten vor' : ''}, Felder diktieren und jederzeit pausieren – der Fortschritt wird gespeichert.</p>
      </div>
      <ol className="flex gap-1 overflow-x-auto no-scrollbar text-xs">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button type="button" onClick={() => setStep(s.key)} className={clsx('px-3 py-1.5 rounded-full whitespace-nowrap font-medium', i === idx ? 'bg-brand text-brand-fg' : i < idx ? 'bg-brand-soft text-brand' : 'bg-white border border-line text-muted')}>
              {i + 1}. {s.label}
            </button>
          </li>
        ))}
      </ol>

      <section className="card p-4 sm:p-6 space-y-3">
        {step === 'person' && (
          <>
            <h2 className="font-semibold text-lg">Zur Person</h2>
            <p className="text-sm text-muted">Tipp: Fotografiere im Schritt „Dokumente“ deinen Ausweis und die e-card – dann sind diese Felder schon ausgefüllt.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {renderInput({ group: "person", k: "firstName", label: "Vorname", required: true })}
              {renderInput({ group: "person", k: "lastName", label: "Nachname", required: true })}
              {renderInput({ group: "person", k: "title", label: "Titel", placeholder: "optional" })}
              {renderInput({ group: "person", k: "birthDate", label: "Geburtsdatum", type: "date", required: true })}
              {renderInput({ group: "person", k: "svNumber", label: "SV-Nummer (10 Ziffern)", inputMode: "numeric", mode: "digits", required: true, hint: svCheck ? svCheck.ok ? <span className="text-emerald-700">Prüfziffer ok</span> : <span className="text-red-700">{svCheck.reason}</span> : 'steht auf der e-card: 4 Ziffern + Geburtsdatum' })}
              {renderInput({ group: "person", k: "nationality", label: "Staatsbürgerschaft", required: true, placeholder: "Österreich" })}
              {renderInput({ group: "person", k: "birthPlace", label: "Geburtsort", placeholder: "optional" })}
              <Field label="Geschlecht" htmlFor="person.gender">
                <select id="person.gender" className="input" value={val('person', 'gender')} onChange={(e) => set('person', 'gender', e.target.value)}>
                  <option value="">keine Angabe</option>
                  <option value="w">weiblich</option>
                  <option value="m">männlich</option>
                  <option value="d">divers</option>
                </select>
              </Field>
              <Field label="Familienstand" htmlFor="person.maritalStatus">
                <select id="person.maritalStatus" className="input" value={val('person', 'maritalStatus')} onChange={(e) => set('person', 'maritalStatus', e.target.value)}>
                  <option value="">keine Angabe</option>
                  <option value="ledig">ledig</option>
                  <option value="verheiratet">verheiratet</option>
                  <option value="eingetragene_partnerschaft">eingetragene Partnerschaft</option>
                  <option value="lebensgemeinschaft">Lebensgemeinschaft</option>
                  <option value="geschieden">geschieden</option>
                  <option value="verwitwet">verwitwet</option>
                </select>
              </Field>
            </div>
          </>
        )}

        {step === 'contact' && (
          <>
            <h2 className="font-semibold text-lg">Kontakt & Adresse</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                {renderInput({ group: "contact", k: "street", label: "Straße und Hausnummer", required: true })}
              </div>
              {renderInput({ group: "contact", k: "zip", label: "PLZ", inputMode: "numeric", required: true })}
              {renderInput({ group: "contact", k: "city", label: "Ort", required: true })}
              {renderInput({ group: "contact", k: "country", label: "Land", required: true })}
              {renderInput({ group: "contact", k: "phone", label: "Handynummer", type: "tel", inputMode: "tel", required: true })}
              {renderInput({ group: "contact", k: "privateEmail", label: "Private E-Mail", type: "email", inputMode: "email", placeholder: "optional" })}
              {renderInput({ group: "contact", k: "emergencyName", label: "Notfallkontakt (Name)", placeholder: "optional" })}
              {renderInput({ group: "contact", k: "emergencyPhone", label: "Notfallkontakt (Telefon)", type: "tel", placeholder: "optional" })}
            </div>
          </>
        )}

        {step === 'docs' && (
          <>
            <h2 className="font-semibold text-lg">Dokumente fotografieren</h2>
            <p className="text-sm text-muted">Am Handy öffnet sich die Kamera. Gut ausleuchten, gerade halten, ganzes Dokument im Bild. {ctx.ai ? 'Die Daten werden automatisch ausgelesen und in die Felder übernommen – du prüfst nur noch.' : 'Die Personalverwaltung übernimmt die Daten aus deinen Fotos.'}</p>
            <ul className="space-y-2">
              {DOC_KINDS.filter((k) => k !== 'residence_permit' || permit).map((kind) => {
                const mine = ctx.files.filter((f) => f.kind === kind);
                const required = ['id_card', 'ecard', 'meldezettel'].includes(kind) || (kind === 'residence_permit' && permit);
                return (
                  <li key={kind} className="border border-line rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {DOC_LABELS[kind]}
                          {required && <span className="text-red-700"> *</span>}
                        </div>
                        {mine.length > 0 && (
                          <ul className="text-xs text-emerald-700 mt-1 space-y-0.5">
                            {mine.map((f) => (
                              <li key={f.id} className="flex items-center gap-2">
                                <Check className="w-3 h-3" /> {f.filename} ({Math.round(f.size / 1024)} KB)
                                <button type="button" className="text-muted hover:text-red-700" onClick={() => removeFile(f.id)} aria-label="Entfernen">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <label className="btn-secondary btn-sm cursor-pointer">
                          <Camera className="w-4 h-4" /> Foto
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && upload(kind, e.target.files[0])} disabled={saving} />
                        </label>
                        <label className="btn-ghost btn-sm border border-line cursor-pointer">
                          <Upload className="w-4 h-4" />
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(kind, e.target.files[0])} disabled={saving} />
                        </label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {saving && (
              <p className="text-sm text-muted flex items-center gap-2">
                <Spinner /> Wird hochgeladen{ctx.ai ? ' und ausgelesen' : ''} …
              </p>
            )}
          </>
        )}

        {step === 'bank' && (
          <>
            <h2 className="font-semibold text-lg">Bankverbindung für die Gehaltsüberweisung</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                {renderInput({ group: "bank", k: "iban", label: "IBAN", mode: "iban", required: true, hint: ibanCheck ? ibanCheck.ok ? <span className="text-emerald-700">IBAN gültig</span> : <span className="text-red-700">{ibanCheck.reason}</span> : 'z. B. AT61 1904 3002 3457 3201' })}
              </div>
              {renderInput({ group: "bank", k: "bic", label: "BIC", placeholder: "optional" })}
              {renderInput({ group: "bank", k: "accountHolder", label: "Kontoinhaber:in (falls abweichend)", placeholder: "optional" })}
            </div>
          </>
        )}

        {step === 'tax' && (
          <>
            <h2 className="font-semibold text-lg">Steuer & Familie</h2>
            <p className="text-sm text-muted">Diese Angaben helfen der Lohnverrechnung, Absetzbeträge (Familienbonus Plus, Alleinverdiener, Pendlerpauschale) richtig zu berücksichtigen. Alles freiwillig – ohne Angabe gibt es keine Nachteile, nur eventuell weniger Netto.</p>
            <div className="space-y-3">
              <div>
                <div className="label">Kinder (für Familienbonus Plus)</div>
                {((data.tax?.children as Array<{ name?: string; birthDate?: string; familienbonus?: boolean }>) || []).map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 mb-2 items-center">
                    <input className="input" placeholder="Name" value={c.name ?? ''} onChange={(e) => updChild(i, { name: e.target.value })} />
                    <input className="input" type="date" value={c.birthDate ?? ''} onChange={(e) => updChild(i, { birthDate: e.target.value })} />
                    <label className="text-xs flex items-center gap-1">
                      <input type="checkbox" checked={!!c.familienbonus} onChange={(e) => updChild(i, { familienbonus: e.target.checked })} /> FB+
                    </label>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => updChild(i, null)} aria-label="Entfernen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-ghost btn-sm border border-line" onClick={() => updChild(-1, { name: '', birthDate: '', familienbonus: true })}>
                  + Kind hinzufügen
                </button>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={!!val('tax', 'avabRequested')} onChange={(e) => set('tax', 'avabRequested', e.target.checked)} /> Ich möchte den Alleinverdiener-/Alleinerzieherabsetzbetrag beantragen (Formular E 30 wird nachgereicht).
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {renderInput({ group: "tax", k: "commuteKm", label: "Entfernung Wohnung–Arbeitsstätte (km)", inputMode: "decimal", mode: "digits", placeholder: "z. B. 23", hint: "für die Pendlerpauschale" })}
                <Field label="Öffentliche Verkehrsmittel zumutbar?" htmlFor="tax.publicTransportReasonable">
                  <select id="tax.publicTransportReasonable" className="input" value={val('tax', 'publicTransportReasonable')} onChange={(e) => set('tax', 'publicTransportReasonable', e.target.value)}>
                    <option value="">weiß ich nicht</option>
                    <option value="ja">ja</option>
                    <option value="nein">nein</option>
                  </select>
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={!!val('tax', 'pendlerrechnerDone')} onChange={(e) => set('tax', 'pendlerrechnerDone', e.target.checked)} /> Ich habe den Pendlerrechner des BMF ausgedruckt und gebe ihn ab (bmf.gv.at/pendlerrechner).
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={!!val('tax', 'otherEmployment')} onChange={(e) => set('tax', 'otherEmployment', e.target.checked)} /> Ich habe daneben noch eine weitere Beschäftigung oder Pension.
              </label>
              {renderInput({ group: "tax", k: "notes", label: "Anmerkung für die Lohnverrechnung", placeholder: "optional" })}
            </div>
          </>
        )}

        {step === 'employment' && (
          <>
            <h2 className="font-semibold text-lg">Beschäftigung</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {renderInput({ group: "employment", k: "jobTitle", label: "Tätigkeit / Berufsbezeichnung", required: true })}
              {renderInput({ group: "employment", k: "startDate", label: "Eintrittsdatum", type: "date", required: true })}
              {renderInput({ group: "employment", k: "weeklyHours", label: "Wochenstunden laut Vertrag", inputMode: "decimal", required: true, placeholder: "z. B. 38,5" })}
              {renderInput({ group: "employment", k: "education", label: "Höchste abgeschlossene Ausbildung", placeholder: "optional" })}
              <div className="sm:col-span-2">
                {renderInput({ group: "employment", k: "previousServiceNote", label: "Vordienstzeiten / bisherige Arbeitgeber (für Einstufung und Urlaub)", placeholder: "optional, z. B. 2019–2024 Firma X, Verkauf" })}
              </div>
              {permit && (
                <>
                  {renderInput({ group: "employment", k: "workPermitType", label: "Aufenthaltstitel / Beschäftigungsbewilligung", required: true, placeholder: "z. B. Rot-Weiß-Rot – Karte plus" })}
                  {renderInput({ group: "employment", k: "workPermitValidUntil", label: "gültig bis", type: "date" })}
                </>
              )}
              <Field label="Begünstigtenstatus (Behinderung) – freiwillig" htmlFor="employment.disabilityStatus" hint="Nur relevant für Ausgleichstaxe/Zusatzurlaub; Angabe ist freiwillig.">
                <select id="employment.disabilityStatus" className="input" value={val('employment', 'disabilityStatus')} onChange={(e) => set('employment', 'disabilityStatus', e.target.value)}>
                  <option value="">keine Angabe</option>
                  <option value="nein">nein</option>
                  <option value="ja">ja (Bescheid vorhanden)</option>
                </select>
              </Field>
              {renderInput({ group: "employment", k: "previousInsurer", label: "Bisherige Krankenversicherung", placeholder: "optional, z. B. ÖGK, SVS, Ausland" })}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={!!val('employment', 'firstJobInAustria')} onChange={(e) => set('employment', 'firstJobInAustria', e.target.checked)} /> Das ist meine erste Beschäftigung in Österreich.
            </label>
          </>
        )}

        {step === 'consents' && (
          <>
            <h2 className="font-semibold text-lg">Prüfen & bestätigen</h2>
            <div className="text-sm bg-paper rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span>Vollständigkeit</span>
                <strong>{ctx.completeness} %</strong>
              </div>
              <div className="h-2 bg-line rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-brand" style={{ width: `${ctx.completeness}%` }} />
              </div>
              {ctx.validation.filter((v) => v.severity !== 'info').length > 0 && (
                <ul className="mt-2 space-y-1">
                  {ctx.validation
                    .filter((v) => v.severity !== 'info')
                    .map((v, i) => (
                      <li key={i} className={clsx('text-xs', v.severity === 'error' ? 'text-red-700' : 'text-amber-800')}>
                        {v.message}
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consents.privacyInfoRead} onChange={(e) => setConsents({ ...consents, privacyInfoRead: e.target.checked })} />
              <span>
                Ich habe die <a className="underline" href={ctx.org.privacyUrl} target="_blank" rel="noreferrer">Datenschutzinformation</a> zur Zeiterfassung und Personalverwaltung gelesen.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consents.timeTrackingConsent} onChange={(e) => setConsents({ ...consents, timeTrackingConsent: e.target.checked })} />
              <span>Ich stimme der elektronischen Arbeitszeiterfassung mit {ctx.org.appName} zu (Beginn, Ende, Pausen, Arbeitsort-Kategorie; kein GPS, keine Verhaltenskontrolle).</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consents.dataCorrect} onChange={(e) => setConsents({ ...consents, dataCorrect: e.target.checked })} />
              <span>Meine Angaben sind richtig und vollständig. Änderungen (Adresse, Bankverbindung, Familienstand) melde ich der Personalverwaltung.</span>
            </label>
          </>
        )}

        {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{error}</p>}
        <div className="flex items-center justify-between pt-2">
          <button type="button" className="btn-ghost" onClick={prev} disabled={idx === 0 || saving}>
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          {step !== 'consents' ? (
            <button type="button" className="btn-primary" onClick={next} disabled={saving} data-testid="onb-next">
              {saving ? <Spinner /> : <>Weiter <ChevronRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={submit} disabled={saving || !consents.privacyInfoRead || !consents.timeTrackingConsent || !consents.dataCorrect} data-testid="onb-submit">
              {saving ? <Spinner /> : <><FileText className="w-4 h-4" /> Absenden</>}
            </button>
          )}
        </div>
      </section>
      <p className="text-xs text-muted text-center">Gespeichert wird bei jedem „Weiter“. Link gültig bis {new Date(ctx.expiresAt).toLocaleDateString('de-AT')}.</p>
    </div>
  );

  function updChild(i: number, patch: Record<string, unknown> | null) {
    setData((d) => {
      const list = [...((d.tax?.children as Array<Record<string, unknown>>) || [])];
      if (i === -1 && patch) list.push(patch);
      else if (patch === null) list.splice(i, 1);
      else list[i] = { ...list[i], ...patch };
      return { ...d, tax: { ...(d.tax || {}), children: list } };
    });
  }
}

/** Client-side downscale to max 1600 px JPEG (keeps uploads small, PDFs pass through). */
async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 400 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    return blob || file;
  } catch {
    return file;
  }
}
