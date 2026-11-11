'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Car, Coffee, Home, MapPin, Pause, Play, Square } from 'lucide-react';
import clsx from 'clsx';
import type { TimerState } from '@/lib/timer';
import { formatMinutes } from '@/domain/time';
import { queueOrSend } from '@/lib/offline-queue';

interface Project {
  id: string;
  code: string;
  name: string;
  color: string | null;
}

const LOCATIONS = [
  { key: 'office', label: 'Büro', Icon: Briefcase },
  { key: 'remote', label: 'Telearbeit', Icon: Home },
  { key: 'field', label: 'Außendienst', Icon: MapPin },
] as const;

export function TimerCard({ initial, projects, recordMode, todayDate, hints, workedTodayMinutes }: { initial: TimerState; projects: Project[]; recordMode: 'full' | 'duration_only'; todayDate: string; hints: string[]; workedTodayMinutes: number }) {
  const router = useRouter();
  const [state, setState] = useState<TimerState>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<TimerState['location']>(initial.location || guessLocation());
  const [type, setType] = useState<TimerState['type']>(initial.type);
  const [projectId, setProjectId] = useState<string | null>(initial.projectId);
  const [note, setNote] = useState(initial.note ?? '');
  const [quick, setQuick] = useState({ duration: '', location: guessLocation(), projectId: '' });
  const tick = useRef<number | null>(null);

  useEffect(() => {
    tick.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, []);

  const live = useMemo(() => {
    if (!state.running || !state.startedAt) return { elapsed: 0, breakSec: 0 };
    const gross = Math.max(0, Math.floor((now - new Date(state.startedAt).getTime()) / 1000));
    const breakLive = state.breakStartedAt ? Math.max(0, Math.floor((now - new Date(state.breakStartedAt).getTime()) / 1000)) : 0;
    const breakTotal = state.breakMinutes * 60 - (state.breakStartedAt ? 0 : 0) + (state.breakStartedAt ? breakLive - Math.min(breakLive, 0) : 0);
    const breaksSec = (state.breakMinutes - (state.breakStartedAt ? Math.floor(breakLive / 60) : 0)) * 60 + breakLive;
    void breakTotal;
    return { elapsed: Math.max(0, gross - breaksSec), breakSec: breakLive };
  }, [now, state]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await queueOrSend('/api/timer', { ...body, at: new Date().toISOString() });
        if (res.queued) {
          // optimistic local state while offline
          setState((prev) => optimistic(prev, body));
        } else if (!res.ok) {
          throw new Error(res.data?.error || 'Fehler');
        } else {
          setState(res.data as TimerState);
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Fehler');
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  async function quickBook() {
    const [h, m] = quick.duration.split(':').map(Number);
    const minutes = Number.isFinite(m) ? h * 60 + m : Math.round(Number(quick.duration.replace(',', '.')) * 60);
    if (!minutes || minutes <= 0) return setError('Bitte Dauer angeben, z. B. 7:30');
    setBusy(true);
    setError(null);
    const res = await fetch('/api/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: todayDate, durationMinutes: minutes, location: quick.location, projectId: quick.projectId || null, type: 'work' }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error || 'Fehler');
    setQuick({ ...quick, duration: '' });
    router.refresh();
  }

  if (recordMode === 'duration_only') {
    return (
      <section className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Tagesarbeitszeit erfassen</h2>
          <span className="text-xs text-muted">Nur Dauer (§ 26 Abs 3 AZG)</span>
        </div>
        <p className="text-sm text-muted mb-3">Heute bisher {formatMinutes(workedTodayMinutes)} h gebucht.</p>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input className="input text-lg font-semibold" placeholder="z. B. 7:30" inputMode="numeric" value={quick.duration} onChange={(e) => setQuick({ ...quick, duration: e.target.value })} aria-label="Dauer" />
          <button className="btn-primary" onClick={quickBook} disabled={busy}>
            Buchen
          </button>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {LOCATIONS.map((l) => (
            <button key={l.key} type="button" onClick={() => setQuick({ ...quick, location: l.key })} className={clsx('btn btn-sm', quick.location === l.key ? 'btn-secondary' : 'btn-ghost border border-line')}>
              <l.Icon className="w-4 h-4" /> {l.label}
            </button>
          ))}
          <select className="input btn-sm max-w-[200px]" value={quick.projectId} onChange={(e) => setQuick({ ...quick, projectId: e.target.value })} aria-label="Projekt">
            <option value="">Kein Projekt</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} – {p.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        {hints.map((h, i) => (
          <p key={i} className="text-sm mt-2 text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            {h}
          </p>
        ))}
      </section>
    );
  }

  return (
    <section className={clsx('card p-5 transition-colors', state.running && !state.onBreak && 'ring-2 ring-brand/40', state.onBreak && 'ring-2 ring-amber-400/60')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted font-semibold">{state.running ? (state.onBreak ? 'Pause läuft' : 'Läuft seit ' + new Date(state.startedAt!).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })) : 'Nicht eingestempelt'}</div>
          <div className="text-5xl font-black tabular-nums tracking-tight mt-1" data-testid="timer-display">
            {state.running ? fmt(live.elapsed) : '0:00:00'}
          </div>
          {state.running && (
            <div className="text-xs text-muted mt-1">
              Pausen {state.breakMinutes + (state.onBreak ? Math.floor(live.breakSec / 60) : 0)} min {state.onBreak && <span className="text-amber-700 font-medium">· aktuelle Pause {fmt(live.breakSec)}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {!state.running ? (
            <button className="btn-primary h-14 px-6 text-base" onClick={() => act({ action: 'start', type, location, projectId, note: note || null })} disabled={busy} data-testid="timer-start">
              <Play className="w-5 h-5" /> Start
            </button>
          ) : (
            <>
              <button className="btn-danger h-12" onClick={() => act({ action: 'stop', note: note || null })} disabled={busy} data-testid="timer-stop">
                <Square className="w-4 h-4" /> Stopp
              </button>
              {state.onBreak ? (
                <button className="btn-secondary h-12" onClick={() => act({ action: 'break_end' })} disabled={busy}>
                  <Play className="w-4 h-4" /> Weiter
                </button>
              ) : (
                <button className="btn-secondary h-12" onClick={() => act({ action: 'break_start' })} disabled={busy} data-testid="timer-break">
                  <Coffee className="w-4 h-4" /> Pause
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {LOCATIONS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => {
              setLocation(l.key);
              if (state.running) act({ action: 'update', location: l.key });
            }}
            className={clsx('btn btn-sm', location === l.key ? 'btn-secondary' : 'btn-ghost border border-line')}
            aria-pressed={location === l.key}
          >
            <l.Icon className="w-4 h-4" /> {l.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const t = type === 'travel' ? 'work' : 'travel';
            setType(t);
            if (state.running) act({ action: 'update', type: t });
          }}
          className={clsx('btn btn-sm', type === 'travel' ? 'btn-secondary' : 'btn-ghost border border-line')}
          aria-pressed={type === 'travel'}
        >
          <Car className="w-4 h-4" /> Reisezeit
        </button>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <select
          className="input"
          value={projectId ?? ''}
          onChange={(e) => {
            const v = e.target.value || null;
            setProjectId(v);
            if (state.running) act({ action: 'update', projectId: v });
          }}
          aria-label="Projekt / Kostenstelle"
        >
          <option value="">Kein Projekt</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} – {p.name}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => state.running && act({ action: 'update', note: note || null })} maxLength={500} />
      </div>
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
      {hints.map((h, i) => (
        <p key={i} className="text-sm mt-2 text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex gap-2">
          <Pause className="w-4 h-4 shrink-0 mt-0.5" /> {h}
        </p>
      ))}
    </section>
  );
}

function guessLocation(): 'office' | 'remote' | 'field' {
  if (typeof window === 'undefined') return 'office';
  try {
    const v = window.localStorage.getItem('zt:lastLocation');
    if (v === 'remote' || v === 'field' || v === 'office') return v;
  } catch {
    /* ignore */
  }
  return 'office';
}

function optimistic(prev: TimerState, body: Record<string, unknown>): TimerState {
  const at = String(body.at ?? new Date().toISOString());
  switch (body.action) {
    case 'start':
      return { ...prev, running: true, startedAt: at, onBreak: false, breakStartedAt: null, breakMinutes: 0, elapsedMinutes: 0, location: (body.location as TimerState['location']) ?? prev.location, projectId: (body.projectId as string | null) ?? null, note: (body.note as string | null) ?? null, type: (body.type as TimerState['type']) ?? 'work' };
    case 'stop':
      return { ...prev, running: false, startedAt: null, onBreak: false, breakStartedAt: null, breakMinutes: 0, elapsedMinutes: 0 };
    case 'break_start':
      return { ...prev, onBreak: true, breakStartedAt: at };
    case 'break_end':
      return { ...prev, onBreak: false, breakStartedAt: null, breakMinutes: prev.breakMinutes + (prev.breakStartedAt ? Math.round((new Date(at).getTime() - new Date(prev.breakStartedAt).getTime()) / 60000) : 0) };
    default:
      return { ...prev, ...(body.location ? { location: body.location as TimerState['location'] } : {}), ...(body.projectId !== undefined ? { projectId: body.projectId as string | null } : {}) };
  }
}
