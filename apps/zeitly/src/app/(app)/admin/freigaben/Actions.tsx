'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';

export function PeriodActions({ userId, year, month, canReopen, status }: { userId: string; year: number; month: number; canReopen: boolean; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/periods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, year, month, ...body }) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error || 'Fehler');
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      {(status === 'submitted' || status === 'open' || status === 'reopened') && (
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => post({ action: 'approve' })} data-testid="approve-period">
          {busy ? <Spinner /> : 'Freigeben'}
        </button>
      )}
      {canReopen && status !== 'open' && (
        <button
          className="btn-ghost btn-sm text-muted"
          disabled={busy}
          onClick={() => {
            const reason = prompt('Grund für das Wiederöffnen (wird protokolliert):');
            if (reason) post({ action: 'reopen', reason });
          }}
        >
          Öffnen
        </button>
      )}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}

export function AbsenceDecision({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function decide(status: 'approved' | 'rejected') {
    setBusy(true);
    await fetch(`/api/absences/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <button className="btn-primary btn-sm" disabled={busy} onClick={() => decide('approved')}>
        Genehmigen
      </button>
      <button className="btn-ghost btn-sm text-red-700" disabled={busy} onClick={() => decide('rejected')}>
        Ablehnen
      </button>
    </div>
  );
}
