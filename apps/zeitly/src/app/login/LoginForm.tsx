'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';

export function LoginForm({ orgSlug, next, demoAccounts }: { orgSlug: string | null; next: string | null; demoAccounts: Array<{ email: string; name: string; role: string; org: string }> }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setDemoCode(data.demoCode ?? null);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code, org: orgSlug }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      router.replace(next || data.redirect || '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {step === 'email' ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Dienstliche E-Mail-Adresse
            </label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vorname.nachname@firma.at" autoFocus />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || !email}>
            {busy ? <Spinner /> : 'Code anfordern'}
          </button>
          {demoAccounts.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Demo-Konten anzeigen</summary>
              <ul className="mt-2 space-y-1 max-h-56 overflow-auto">
                {demoAccounts.map((a) => (
                  <li key={a.email}>
                    <button type="button" className="text-left w-full px-2 py-1 rounded hover:bg-black/5" onClick={() => setEmail(a.email)}>
                      <span className="font-medium">{a.name}</span> <span className="text-muted">· {a.role} · {a.org}</span>
                      <div className="text-xs text-muted">{a.email}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm">
            Wir haben einen Code an <strong>{email}</strong> gesendet, falls ein Konto besteht.
          </p>
          {demoCode && (
            <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-2" data-testid="demo-code">
              Demo-Modus – dein Code: <strong className="tracking-widest">{demoCode}</strong>
            </p>
          )}
          <div>
            <label className="label" htmlFor="code">
              6-stelliger Code
            </label>
            <input id="code" className="input text-center text-2xl tracking-[0.5em] font-bold" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
            {busy ? <Spinner /> : 'Anmelden'}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-muted underline" onClick={() => setStep('email')}>
              Andere E-Mail
            </button>
            <button type="button" className="text-muted underline" onClick={() => requestCode()} disabled={busy}>
              Code erneut senden
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
