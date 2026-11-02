'use client';
import { useState } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui';

/** "Prüfbericht": deterministic AZG/ARG review of the month, optionally with an AI narrative for the payroll hand-over. */
export function ReviewButton({ userId, year, month }: { userId: string; year: number; month: number }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ text: string; ai: string | null; aiEnabled: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/admin/review?userId=${userId}&year=${year}&month=${month}`);
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || 'Fehler');
    setRes(d);
  }
  return (
    <div className="inline-block">
      <button className="btn-secondary btn-sm" onClick={run} disabled={busy} data-testid="review-run">
        {busy ? <Spinner /> : <ShieldCheck className="w-4 h-4" />} Prüfbericht
      </button>
      {err && <p className="text-xs text-red-700 mt-1">{err}</p>}
      {res && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setRes(null)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-auto p-4 sm:p-6" onClick={(e) => e.stopPropagation()} data-testid="review-dialog">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Prüfbericht Arbeitszeit {String(month).padStart(2, '0')}/{year}
            </h3>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{res.text}</pre>
            {res.ai ? (
              <div className="mt-4 rounded-lg border border-brand/20 bg-brand-soft p-3">
                <div className="text-xs font-semibold text-brand flex items-center gap-1 mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> KI-Einordnung (unverbindlich, auf Basis der obigen Fakten)
                </div>
                <p className="text-sm whitespace-pre-wrap">{res.ai}</p>
              </div>
            ) : (
              <p className="text-xs text-muted mt-3">{res.aiEnabled ? 'Keine KI-Einordnung verfügbar.' : 'KI-Einordnung nicht aktiviert (ANTHROPIC_API_KEY).'}</p>
            )}
            <p className="text-xs text-muted mt-3">Der Bericht ersetzt keine Rechtsberatung; Zuschlagshöhen richten sich nach dem anzuwendenden Kollektivvertrag.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(res.text + (res.ai ? '\n\n' + res.ai : ''))}>
                Kopieren
              </button>
              <button className="btn-primary btn-sm" onClick={() => setRes(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
