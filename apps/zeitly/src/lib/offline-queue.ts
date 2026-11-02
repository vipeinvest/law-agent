/**
 * Minimal offline queue for timer actions (client-side).
 * When the network is unavailable the request is stored in localStorage and replayed on reconnect.
 */
const KEY = 'zt:queue:v1';

interface Queued {
  url: string;
  body: Record<string, unknown>;
  ts: number;
}

function load(): Queued[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function save(q: Queued[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

export async function queueOrSend(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; queued: boolean; data: any }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const q = load();
    q.push({ url, body, ts: Date.now() });
    save(q);
    return { ok: true, queued: true, data: null };
  }
  try {
    await flushQueue();
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, queued: false, data };
  } catch {
    const q = load();
    q.push({ url, body, ts: Date.now() });
    save(q);
    return { ok: true, queued: true, data: null };
  }
}

export async function flushQueue(): Promise<number> {
  const q = load();
  if (q.length === 0) return 0;
  let done = 0;
  for (const item of [...q]) {
    try {
      const res = await fetch(item.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item.body) });
      if (res.status >= 500) break; // server trouble – keep for later
      q.shift();
      done++;
      save(q);
    } catch {
      break;
    }
  }
  return done;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueue().then((n) => n > 0 && window.location.reload());
  });
}
