'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck } from 'lucide-react';
import { Spinner } from '@/components/ui';

/** "Wie geplant übernehmen" – creates time entries from the published roster for a day or range. */
export function PlanAdopt({ from, to, label, userId, small }: { from: string; to?: string; label?: string; userId?: string; small?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/plan/adopt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from, to: to ?? from, userId }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || 'Fehler');
    setMsg(d.created ? `${d.created} Tag(e) übernommen.` : 'Nichts zu übernehmen (schon gebucht oder Schicht läuft noch).');
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button className={small ? 'btn-secondary btn-sm' : 'btn-secondary'} onClick={run} disabled={busy} data-testid="plan-adopt">
        {busy ? <Spinner /> : <CalendarCheck className="w-4 h-4" />} {label ?? 'Wie geplant übernehmen'}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
