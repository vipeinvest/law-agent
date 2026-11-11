'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Spinner } from '@/components/ui';
import type { OrgRules } from '@/domain/types';
import type { OrgTheme } from '@/lib/org';
import { WEEKDAYS_SHORT } from '@/lib/format';

type Codes = Record<string, { code: string; label: string; unit: 'h' | 'd' }>;

export function SettingsForm({ org, rules, theme, codes, defaultCodes, loginUrl }: { org: { name: string; legalName: string; address: string; uidNumber: string; contactEmail: string; payrollEmail: string; timeZone: string; slug: string }; rules: OrgRules; theme: OrgTheme; codes: Codes; defaultCodes: Codes; loginUrl: string }) {
  const router = useRouter();
  const [o, setO] = useState(org);
  const [r, setR] = useState(rules);
  const [t, setT] = useState(theme);
  const [c, setC] = useState(codes);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const h = (min: number) => (min / 60).toString().replace('.', ',');
  const toMin = (v: string) => Math.round(Number(v.replace(',', '.')) * 60) || 0;

  async function save(section: string, body: Record<string, unknown>) {
    setBusy(section);
    setMsg(null);
    const res = await fetch('/api/admin/org', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) return setMsg({ ok: false, text: (await res.json().catch(() => ({}))).error || 'Fehler' });
    setMsg({ ok: true, text: 'Gespeichert.' });
    router.refresh();
  }

  function onLogo(file: File | null) {
    if (!file) return setT({ ...t, logoDataUrl: null });
    if (file.size > 150_000) return setMsg({ ok: false, text: 'Logo bitte unter 150 KB (PNG/SVG, am besten quer).' });
    const reader = new FileReader();
    reader.onload = () => setT({ ...t, logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      {msg && <p className={`text-sm sticky top-14 md:top-2 z-10 px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>}

      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-3">Betrieb</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Anzeigename" htmlFor="o-name">
            <input id="o-name" className="input" value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} />
          </Field>
          <Field label="Firmenwortlaut" htmlFor="o-legal">
            <input id="o-legal" className="input" value={o.legalName} onChange={(e) => setO({ ...o, legalName: e.target.value })} />
          </Field>
          <Field label="Adresse" htmlFor="o-addr">
            <input id="o-addr" className="input" value={o.address} onChange={(e) => setO({ ...o, address: e.target.value })} />
          </Field>
          <Field label="UID" htmlFor="o-uid">
            <input id="o-uid" className="input" value={o.uidNumber} onChange={(e) => setO({ ...o, uidNumber: e.target.value })} />
          </Field>
          <Field label="Kontakt-E-Mail" htmlFor="o-mail">
            <input id="o-mail" type="email" className="input" value={o.contactEmail} onChange={(e) => setO({ ...o, contactEmail: e.target.value })} />
          </Field>
          <Field label="E-Mail Lohnverrechnung / Steuerberatung" htmlFor="o-pay" hint="Empfänger für den Monatsexport">
            <input id="o-pay" type="email" className="input" value={o.payrollEmail} onChange={(e) => setO({ ...o, payrollEmail: e.target.value })} />
          </Field>
          <Field label="Zeitzone" htmlFor="o-tz">
            <input id="o-tz" className="input" value={o.timeZone} onChange={(e) => setO({ ...o, timeZone: e.target.value })} />
          </Field>
          <Field label="Login-Link für Mitarbeiter:innen">
            <input className="input text-xs" readOnly value={loginUrl} onFocus={(e) => e.target.select()} />
          </Field>
        </div>
        <button className="btn-primary btn-sm mt-4" disabled={busy !== null} onClick={() => save('org', { name: o.name, legalName: o.legalName || null, address: o.address || null, uidNumber: o.uidNumber || null, contactEmail: o.contactEmail || null, payrollEmail: o.payrollEmail || null, timeZone: o.timeZone })}>
          {busy === 'org' ? <Spinner /> : 'Betrieb speichern'}
        </button>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-1">Arbeitszeitregeln</h2>
        <p className="text-sm text-muted mb-3">Gesetzliche Grenzen (AZG/ARG) sind voreingestellt. Kollektivvertragliche Werte (z. B. 38,5 h) hier eintragen.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Normalarbeitszeit / Tag (h)" htmlFor="r-nd" hint="AZG § 3: 8 h">
            <input id="r-nd" className="input" defaultValue={h(r.normalDailyMinutes)} onBlur={(e) => setR({ ...r, normalDailyMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Normalarbeitszeit / Woche (h)" htmlFor="r-nw" hint="AZG § 3: 40 h, KV oft 38,5 h">
            <input id="r-nw" className="input" defaultValue={h(r.normalWeeklyMinutes)} onBlur={(e) => setR({ ...r, normalWeeklyMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Vollzeitgrenze für Mehrarbeit (h/Woche)" htmlFor="r-ft" hint="AZG § 19d: Teilzeit über Vertrag bis hierher = Mehrarbeit">
            <input id="r-ft" className="input" defaultValue={h(r.fullTimeWeeklyMinutes)} onBlur={(e) => setR({ ...r, fullTimeWeeklyMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Überstunden ab (h/Tag)" htmlFor="r-otd" hint="Standard = Normalarbeitszeit; bei Gleitzeit automatisch 10 h">
            <input id="r-otd" className="input" defaultValue={h(r.overtimeThresholdDailyMinutes)} onBlur={(e) => setR({ ...r, overtimeThresholdDailyMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Überstunden ab (h/Woche)" htmlFor="r-otw">
            <input id="r-otw" className="input" defaultValue={h(r.overtimeThresholdWeeklyMinutes)} onBlur={(e) => setR({ ...r, overtimeThresholdWeeklyMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Rundung (Minuten)" htmlFor="r-round" hint="0 = minutengenau">
            <select id="r-round" className="input" value={r.roundingMinutes} onChange={(e) => setR({ ...r, roundingMinutes: Number(e.target.value) as OrgRules['roundingMinutes'] })}>
              {[0, 1, 5, 10, 15].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Höchstgrenze / Tag (h)" htmlFor="r-md" hint="AZG § 9: 12 h">
            <input id="r-md" className="input" defaultValue={h(r.maxDailyMinutes)} onBlur={(e) => setR({ ...r, maxDailyMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Höchstgrenze / Woche (h)" htmlFor="r-mw" hint="AZG § 9: 60 h">
            <input id="r-mw" className="input" defaultValue={h(r.maxWeeklyMinutes)} onBlur={(e) => setR({ ...r, maxWeeklyMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Tägliche Ruhezeit (h)" htmlFor="r-rest" hint="AZG § 12: 11 h">
            <input id="r-rest" className="input" defaultValue={h(r.minDailyRestMinutes)} onBlur={(e) => setR({ ...r, minDailyRestMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Pause nötig ab (h)" htmlFor="r-ba" hint="AZG § 11: > 6 h">
            <input id="r-ba" className="input" defaultValue={h(r.breakAfterMinutes)} onBlur={(e) => setR({ ...r, breakAfterMinutes: toMin(e.target.value) })} />
          </Field>
          <Field label="Mindestpause (min)" htmlFor="r-bm" hint="AZG § 11: 30 min">
            <input id="r-bm" type="number" className="input" value={r.minBreakMinutes} onChange={(e) => setR({ ...r, minBreakMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Standard-Arbeitstage">
            <div className="flex gap-1 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button type="button" key={d} className={`btn btn-sm ${r.defaultWorkDays.includes(d) ? 'btn-secondary' : 'btn-ghost border border-line'}`} onClick={() => setR({ ...r, defaultWorkDays: r.defaultWorkDays.includes(d) ? r.defaultWorkDays.filter((x) => x !== d) : [...r.defaultWorkDays, d].sort() })}>
                  {WEEKDAYS_SHORT[d - 1]}
                </button>
              ))}
            </div>
          </Field>
          <div className="sm:col-span-2 lg:col-span-3 space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={r.fixedBreakAgreement} onChange={(e) => setR({ ...r, fixedBreakAgreement: e.target.checked })} />
              <span>Pausen sind durch Betriebsvereinbarung/schriftliche Vereinbarung fix geregelt (AZG § 26 Abs 5) – keine Pausenaufzeichnung nötig, Warnung „Pause fehlt“ entfällt.</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={r.autoBreakDeduction} disabled={!r.fixedBreakAgreement} onChange={(e) => setR({ ...r, autoBreakDeduction: e.target.checked })} />
              <span>Fehlende Pause automatisch abziehen (30 min ab 6 h) – wird im Nachweis als „Pause lt. Vereinbarung“ ausgewiesen. Nur mit fixer Pausenregelung.</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={r.travelCountsAsWork} onChange={(e) => setR({ ...r, travelCountsAsWork: e.target.checked })} />
              <span>Reisezeit zählt als Arbeitszeit (AZG § 20b) – eigener Bucket im Export bleibt erhalten.</span>
            </label>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2">
                24.12. <input type="checkbox" checked={(r.extraHolidays['12-24'] ?? 0) > 0} onChange={(e) => setR({ ...r, extraHolidays: { ...r.extraHolidays, '12-24': e.target.checked ? 0.5 : 0 } })} /> halber Tag frei
              </label>
              <label className="flex items-center gap-2">
                31.12. <input type="checkbox" checked={(r.extraHolidays['12-31'] ?? 0) > 0} onChange={(e) => setR({ ...r, extraHolidays: { ...r.extraHolidays, '12-31': e.target.checked ? 0.5 : 0 } })} /> halber Tag frei
              </label>
            </div>
          </div>
        </div>
        <button className="btn-primary btn-sm mt-4" disabled={busy !== null} onClick={() => save('rules', { rules: r })}>
          {busy === 'rules' ? <Spinner /> : 'Regeln speichern'}
        </button>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-1">Erscheinungsbild (CI)</h2>
        <p className="text-sm text-muted mb-3">Logo, Farben und Name erscheinen in der App, in E-Mails und im PDF-Nachweis.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <Field label="App-Name" htmlFor="t-app">
            <input id="t-app" className="input" value={t.appName ?? ''} onChange={(e) => setT({ ...t, appName: e.target.value || null })} placeholder={o.name} />
          </Field>
          <Field label="Logo-Text (ohne Logo-Datei)" htmlFor="t-lt">
            <input id="t-lt" className="input" value={t.logoText ?? ''} onChange={(e) => setT({ ...t, logoText: e.target.value || null })} />
          </Field>
          <Field label="Primärfarbe" htmlFor="t-p">
            <div className="flex gap-2">
              <input id="t-p" type="color" className="input h-11 p-1 w-16" value={t.primary} onChange={(e) => setT({ ...t, primary: e.target.value })} />
              <input className="input" value={t.primary} onChange={(e) => setT({ ...t, primary: e.target.value })} />
            </div>
          </Field>
          <Field label="Akzentfarbe" htmlFor="t-a">
            <div className="flex gap-2">
              <input id="t-a" type="color" className="input h-11 p-1 w-16" value={t.accent} onChange={(e) => setT({ ...t, accent: e.target.value })} />
              <input className="input" value={t.accent} onChange={(e) => setT({ ...t, accent: e.target.value })} />
            </div>
          </Field>
          <Field label="Ecken" htmlFor="t-r">
            <select id="t-r" className="input" value={t.radius} onChange={(e) => setT({ ...t, radius: e.target.value as OrgTheme['radius'] })}>
              <option value="round">Rund</option>
              <option value="soft">Weich</option>
              <option value="square">Eckig</option>
            </select>
          </Field>
          <Field label="Logo (PNG/SVG, max. 150 KB)" htmlFor="t-logo">
            <input id="t-logo" type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="input pt-2" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />
          </Field>
          <div className="lg:col-span-2 flex items-center gap-3">
            {t.logoDataUrl ? (
              <>
                <img src={t.logoDataUrl} alt="Logo" className="h-10 max-w-[180px] object-contain border border-line rounded p-1 bg-white" />
                <button className="btn-ghost btn-sm" onClick={() => setT({ ...t, logoDataUrl: null })}>
                  Logo entfernen
                </button>
              </>
            ) : (
              <span className="text-sm text-muted">Kein Logo – es wird der Logo-Text bzw. der Anfangsbuchstabe gezeigt.</span>
            )}
          </div>
        </div>
        <div className="mt-3 p-3 rounded-xl border border-line flex items-center gap-3" style={{ background: t.primary, color: '#fff' }}>
          <span className="font-bold">{t.appName || o.name}</span>
          <span className="text-xs opacity-80">Vorschau Kopfzeile</span>
          <span className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold" style={{ background: t.accent }}>
            Akzent
          </span>
        </div>
        <button className="btn-primary btn-sm mt-4" disabled={busy !== null} onClick={() => save('theme', { theme: t })}>
          {busy === 'theme' ? <Spinner /> : 'Erscheinungsbild speichern'}
        </button>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-1">Lohnarten für den Export</h2>
        <p className="text-sm text-muted mb-3">Codes an das System der Lohnverrechnung anpassen (z. B. BMD, RZL, DPW). Sie erscheinen im Blatt „Lohnarten-Import“ und im CSV.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(c).map(([k, v]) => (
            <div key={k} className="flex gap-2 items-center text-sm">
              <input className="input w-24 font-mono" value={v.code} onChange={(e) => setC({ ...c, [k]: { ...v, code: e.target.value } })} aria-label={`Code ${v.label}`} />
              <input className="input flex-1" value={v.label} onChange={(e) => setC({ ...c, [k]: { ...v, label: e.target.value } })} aria-label="Bezeichnung" />
              <span className="text-muted w-6">{v.unit}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary btn-sm" disabled={busy !== null} onClick={() => save('codes', { payrollCodes: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { code: v.code, label: v.label }])) })}>
            {busy === 'codes' ? <Spinner /> : 'Lohnarten speichern'}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setC(defaultCodes)}>
            Standard wiederherstellen
          </button>
        </div>
      </section>
    </div>
  );
}
