'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const SCOPE_LABELS: Record<string, string> = {
  'read:employees': 'Mitarbeiterliste',
  'read:time': 'Zeitbuchungen & Abwesenheiten',
  'read:payroll': 'Monatswerte Lohnverrechnung',
  'read:profiles': 'Personalstammdaten (Onboarding)',
  'read:shifts': 'Dienstplan',
};

/** Owner-only management of read-only API keys for payroll/accounting integrations (key shown exactly once). */
export function ApiKeysPanel({ isOwner, apiBase, timeZone }: { isOwner: boolean; apiBase: string; timeZone: string }) {
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [scopes, setScopes] = useState<string[]>([]);
  const [name, setName] = useState('Lohnverrechnung');
  const [sel, setSel] = useState<string[]>(['read:payroll']);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/apikeys');
    if (!r.ok) return;
    const d = await r.json();
    setKeys(d.keys);
    setScopes(d.scopes);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/admin/apikeys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', name, scopes: sel }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || 'Fehler');
    setFresh(d.key);
    load();
  }
  async function revoke(id: string, n: string) {
    if (!confirm(`Schlüssel „${n}“ widerrufen? Verbundene Systeme verlieren sofort den Zugriff.`)) return;
    const r = await fetch('/api/admin/apikeys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'revoke', id }) });
    if (!r.ok) return setMsg('Widerruf fehlgeschlagen');
    load();
  }
  const active = keys?.filter((k) => !k.revoked_at) ?? [];

  return (
    <section className="card p-4 sm:p-5" data-testid="apikeys-panel">
      <h2 className="font-semibold mb-1 flex items-center gap-2">
        <KeyRound className="w-4 h-4" /> Schnittstelle Lohnverrechnung / Buchhaltung (API)
      </h2>
      <p className="text-sm text-muted mb-3">
        Lesender Zugriff für Steuerberatung oder Lohnsoftware per REST-API (JSON). Endpunkte: <code className="text-xs">{apiBase}/api/v1/payroll/&#123;jahr&#125;/&#123;monat&#125;</code>, <code className="text-xs">/employees</code>, <code className="text-xs">/time-entries</code>, <code className="text-xs">/absences</code>, <code className="text-xs">/shifts</code>. Authentifizierung mit <code className="text-xs">Authorization: Bearer &lt;Schlüssel&gt;</code>. Dokumentation: <code className="text-xs">ops/API.md</code>. Jeder Zugriff wird protokolliert; Schlüssel können jederzeit widerrufen werden.
      </p>
      {!keys ? (
        <Spinner />
      ) : (
        <>
          {active.length === 0 ? (
            <p className="text-sm text-muted mb-3">Noch kein Schlüssel angelegt.</p>
          ) : (
            <ul className="divide-y divide-line text-sm mb-3">
              {active.map((k) => (
                <li key={k.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {k.name} <span className="text-muted font-mono text-xs">{k.key_prefix}…</span>
                    </div>
                    <div className="text-xs text-muted flex flex-wrap gap-1 mt-0.5">
                      {k.scopes.map((sc) => (
                        <Badge key={sc} tone="gray">
                          {SCOPE_LABELS[sc] ?? sc}
                        </Badge>
                      ))}
                      <span>· erstellt {fmtDateTime(k.created_at, timeZone)}</span>
                      <span>· zuletzt verwendet {k.last_used_at ? fmtDateTime(k.last_used_at, timeZone) : 'nie'}</span>
                    </div>
                  </div>
                  {isOwner && (
                    <button className="btn-ghost btn-sm text-red-700" onClick={() => revoke(k.id, k.name)} aria-label="Widerrufen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {fresh && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm" data-testid="apikey-fresh">
              <div className="font-medium text-emerald-800 mb-1">Neuer Schlüssel – wird nur jetzt einmal angezeigt. Sicher übermitteln (z. B. Passwort-Manager), nicht per E-Mail.</div>
              <div className="flex items-center gap-2">
                <code className="text-xs break-all flex-1">{fresh}</code>
                <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(fresh)} aria-label="Kopieren">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {isOwner ? (
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-2">
                <label className="block text-sm">
                  <span className="text-muted">Bezeichnung</span>
                  <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                </label>
                <div className="flex flex-wrap gap-3 text-sm">
                  {scopes.map((sc) => (
                    <label key={sc} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={sel.includes(sc)} onChange={(e) => setSel(e.target.checked ? [...sel, sc] : sel.filter((x) => x !== sc))} /> {SCOPE_LABELS[sc] ?? sc}
                    </label>
                  ))}
                </div>
              </div>
              <button className="btn-primary" onClick={create} disabled={busy || !name.trim() || sel.length === 0} data-testid="apikey-create">
                {busy ? <Spinner /> : <KeyRound className="w-4 h-4" />} Schlüssel erzeugen
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted">Schlüssel können nur von Inhaber:innen erzeugt und widerrufen werden.</p>
          )}
          {msg && <p className="text-sm text-red-700 mt-2">{msg}</p>}
        </>
      )}
    </section>
  );
}
