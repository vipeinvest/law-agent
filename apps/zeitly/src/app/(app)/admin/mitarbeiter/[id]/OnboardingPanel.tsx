'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileDown, Mail, Send, ShieldCheck } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { DOC_LABELS, type DocKind } from '@/domain/onboarding';

interface Props {
  userId: string;
  userName: string;
  payrollEmail: string | null;
  onboarding: { status: string; expiresAt: string; submittedAt: string | null } | null;
  profile: { data: Record<string, Record<string, unknown>>; completeness: number; validation: Array<{ severity: string; message: string }>; submittedAt: string | null; reviewedAt: string | null; sentToPayrollAt: string | null } | null;
  files: Array<{ id: string; kind: DocKind; filename: string; mime: string; size: number }>;
}

const LABELS: Record<string, string> = {
  'person.firstName': 'Vorname', 'person.lastName': 'Nachname', 'person.title': 'Titel', 'person.birthDate': 'Geburtsdatum', 'person.birthPlace': 'Geburtsort', 'person.svNumber': 'SV-Nummer', 'person.nationality': 'Staatsbürgerschaft', 'person.gender': 'Geschlecht', 'person.maritalStatus': 'Familienstand',
  'contact.street': 'Straße', 'contact.zip': 'PLZ', 'contact.city': 'Ort', 'contact.country': 'Land', 'contact.phone': 'Telefon', 'contact.privateEmail': 'Private E-Mail', 'contact.emergencyName': 'Notfallkontakt', 'contact.emergencyPhone': 'Notfall-Telefon',
  'bank.iban': 'IBAN', 'bank.bic': 'BIC', 'bank.accountHolder': 'Kontoinhaber:in',
  'tax.avabRequested': 'AVAB/AEAB', 'tax.commuteKm': 'Pendelstrecke km', 'tax.publicTransportReasonable': 'Öffi zumutbar', 'tax.pendlerrechnerDone': 'Pendlerrechner', 'tax.otherEmployment': 'Weitere Beschäftigung', 'tax.notes': 'Anmerkung', 'tax.children': 'Kinder',
  'employment.jobTitle': 'Tätigkeit', 'employment.startDate': 'Eintritt', 'employment.weeklyHours': 'Wochenstunden', 'employment.education': 'Ausbildung', 'employment.previousServiceNote': 'Vordienstzeiten', 'employment.workPermitType': 'Aufenthaltstitel', 'employment.workPermitValidUntil': 'gültig bis', 'employment.disabilityStatus': 'Begünstigtenstatus', 'employment.previousInsurer': 'Bisherige Versicherung', 'employment.firstJobInAustria': 'Erste Beschäftigung AT',
};

export function OnboardingPanel({ userId, userName, payrollEmail, onboarding, profile, files }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [to, setTo] = useState(payrollEmail ?? '');

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg(null);
    const r = await fetch('/api/admin/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, action, ...extra }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: d.error || 'Fehler' });
    if (action === 'invite') setMsg({ ok: true, text: `Fragebogen-Link gesendet (gültig bis ${new Date(d.expiresAt).toLocaleDateString('de-AT')}).` });
    if (action === 'review') setMsg({ ok: true, text: 'Als geprüft markiert.' });
    if (action === 'send_payroll') setMsg({ ok: true, text: `Personalstammblatt + ÖGK-Mindestangaben an ${d.to} gesendet.${d.preview ? ' (Demo: nur protokolliert)' : ''}` });
    router.refresh();
  }

  const status = profile?.sentToPayrollAt ? 'an LV gesendet' : profile?.reviewedAt ? 'geprüft' : onboarding?.status === 'submitted' ? 'eingereicht' : onboarding ? onboarding.status === 'opened' ? 'in Bearbeitung' : onboarding.status === 'expired' ? 'Link abgelaufen' : 'Link gesendet' : 'nicht gestartet';
  const entries = profile ? Object.entries(profile.data).flatMap(([g, fields]) => Object.entries(fields || {}).map(([k, v]) => [`${g}.${k}`, v] as const)) : [];

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Onboarding-Fragebogen</h2>
            <div className="text-sm text-muted">
              Status: <Badge tone={status === 'an LV gesendet' || status === 'geprüft' ? 'green' : status === 'eingereicht' ? 'blue' : status === 'nicht gestartet' ? 'gray' : 'amber'}>{status}</Badge>
              {profile && <span className="ml-2">Vollständigkeit {profile.completeness} %</span>}
              {profile?.submittedAt && <span className="ml-2">· abgesendet {new Date(profile.submittedAt).toLocaleString('de-AT')}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" onClick={() => act('invite')} disabled={busy !== null}>
              {busy === 'invite' ? <Spinner /> : <Send className="w-4 h-4" />} {onboarding ? 'Link erneut senden' : 'Fragebogen senden'}
            </button>
            {profile && (
              <a className="btn-ghost btn-sm border border-line" href={`/api/admin/onboarding?userId=${userId}`} onClick={(e) => { e.preventDefault(); window.open('', '_blank'); }} hidden>
                PDF
              </a>
            )}
            {profile && (
              <form method="post" action="/api/admin/onboarding" target="_blank" onSubmit={(e) => { e.preventDefault(); openPdf(userId); }}>
                <button className="btn-ghost btn-sm border border-line">
                  <FileDown className="w-4 h-4" /> Personalstammblatt PDF
                </button>
              </form>
            )}
          </div>
        </div>
        {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}
      </section>

      {profile && (
        <>
          <section className="card p-4 sm:p-5">
            <h3 className="font-semibold mb-2">Prüfung</h3>
            {profile.validation.filter((v) => v.severity !== 'info').length === 0 ? (
              <p className="text-sm text-emerald-700">Keine Auffälligkeiten – SV-Nummer, IBAN, Alter und Aufenthaltsstatus plausibel.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {profile.validation.map((v, i) => (
                  <li key={i} className={v.severity === 'error' ? 'text-red-700' : v.severity === 'warn' ? 'text-amber-800' : 'text-muted'}>
                    • {v.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 mt-3 items-end">
              {!profile.reviewedAt && onboarding?.status === 'submitted' && (
                <button className="btn-primary btn-sm" onClick={() => act('review')} disabled={busy !== null}>
                  <ShieldCheck className="w-4 h-4" /> Als geprüft markieren
                </button>
              )}
              {onboarding?.status === 'submitted' || profile.submittedAt ? (
                <div className="flex gap-2 items-end">
                  <div>
                    <label className="label">Lohnverrechnung</label>
                    <input className="input btn-sm" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="lohn@steuerberatung.at" />
                  </div>
                  <button className="btn-secondary btn-sm" onClick={() => act('send_payroll', { to })} disabled={busy !== null || !to}>
                    {busy === 'send_payroll' ? <Spinner /> : <Mail className="w-4 h-4" />} An Lohnverrechnung senden
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="card p-4 sm:p-5">
            <h3 className="font-semibold mb-2">Angaben von {userName}</h3>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {entries.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-1">
                  <dt className="text-muted">{LABELS[k] || k}</dt>
                  <dd className="font-medium text-right break-all">{fmt(k, v)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-4 sm:p-5">
            <h3 className="font-semibold mb-2">Dokumente ({files.length})</h3>
            {files.length === 0 ? (
              <p className="text-sm text-muted">Noch keine Dokumente hochgeladen.</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                {files.map((f) => (
                  <li key={f.id} className="border border-line rounded-lg p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{DOC_LABELS[f.kind].split(' (')[0]}</div>
                      <div className="text-xs text-muted truncate">
                        {f.filename} · {Math.round(f.size / 1024)} KB
                      </div>
                    </div>
                    <a className="btn-ghost btn-sm" href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" aria-label="Öffnen">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted mt-2">Dokumente sind verschlüsselt gespeichert, der Zugriff wird protokolliert. Aufbewahrung gemäß Löschkonzept (Personalakt, 7 Jahre nach Austritt).</p>
          </section>
        </>
      )}
    </div>
  );
}

function fmt(k: string, v: unknown): string {
  if (v == null || v === '') return '–';
  if (typeof v === 'boolean') return v ? 'ja' : 'nein';
  if (k === 'tax.children' && Array.isArray(v)) return v.length ? v.map((c: { name?: string; birthDate?: string; familienbonus?: boolean }) => `${c.name || 'Kind'} (${c.birthDate || '?'}${c.familienbonus ? ', FB+' : ''})`).join('; ') : 'keine';
  if (k === 'bank.iban') return String(v).replace(/(.{4})/g, '$1 ').trim();
  if (k === 'person.svNumber') return `${String(v).slice(0, 4)} ${String(v).slice(4)}`;
  return String(v);
}

async function openPdf(userId: string) {
  const r = await fetch('/api/admin/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, action: 'pdf' }) });
  if (!r.ok) return alert((await r.json().catch(() => ({}))).error || 'PDF konnte nicht erstellt werden');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
