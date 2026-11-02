'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Spinner } from '@/components/ui';

interface P {
  id?: string;
  code: string;
  name: string;
  customer: string | null;
  costCenter: string | null;
  color: string | null;
  billable: boolean;
  active: boolean;
}
const EMPTY: P = { code: '', name: '', customer: '', costCenter: '', color: '#1f5f5b', billable: false, active: true };

export function ProjectsTable({ projects }: { projects: P[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<P | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!edit) return;
    setBusy(true);
    setErr(null);
    const res = await fetch('/api/admin/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...edit, customer: edit.customer || null, costCenter: edit.costCenter || null, color: edit.color || null }) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error || 'Fehler');
    setEdit(null);
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold mb-3">{edit?.id ? 'Projekt bearbeiten' : 'Neues Projekt'}</h2>
        {!edit ? (
          <button className="btn-primary btn-sm" onClick={() => setEdit({ ...EMPTY })}>
            + Projekt anlegen
          </button>
        ) : (
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <Field label="Kürzel" htmlFor="p-code">
              <input id="p-code" className="input uppercase" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} maxLength={30} />
            </Field>
            <Field label="Name" htmlFor="p-name">
              <input id="p-name" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Kunde" htmlFor="p-cust">
              <input id="p-cust" className="input" value={edit.customer ?? ''} onChange={(e) => setEdit({ ...edit, customer: e.target.value })} />
            </Field>
            <Field label="Kostenstelle" htmlFor="p-cc">
              <input id="p-cc" className="input" value={edit.costCenter ?? ''} onChange={(e) => setEdit({ ...edit, costCenter: e.target.value })} />
            </Field>
            <Field label="Farbe" htmlFor="p-col">
              <input id="p-col" type="color" className="input h-11 p-1" value={edit.color ?? '#1f5f5b'} onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
            </Field>
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={edit.billable} onChange={(e) => setEdit({ ...edit, billable: e.target.checked })} /> verrechenbar
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> aktiv
              </label>
            </div>
            <div className="sm:col-span-3 lg:col-span-6 flex gap-2">
              <button className="btn-primary btn-sm" onClick={save} disabled={busy || !edit.code || !edit.name}>
                {busy ? <Spinner /> : 'Speichern'}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setEdit(null)}>
                Abbrechen
              </button>
              {err && <span className="text-sm text-red-700">{err}</span>}
            </div>
          </div>
        )}
      </div>
      <div className="card overflow-x-auto p-2">
        <table className="table min-w-[560px]">
          <thead>
            <tr>
              <th>Kürzel</th>
              <th>Name</th>
              <th>Kunde</th>
              <th>Kostenstelle</th>
              <th>Verrechenbar</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'opacity-60'}>
                <td>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="w-3 h-3 rounded-full" style={{ background: p.color || '#999' }} />
                    {p.code}
                  </span>
                </td>
                <td>{p.name}</td>
                <td>{p.customer}</td>
                <td>{p.costCenter}</td>
                <td>{p.billable ? 'ja' : ''}</td>
                <td>{p.active ? 'aktiv' : 'archiviert'}</td>
                <td className="text-right">
                  <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...p })}>
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
