'use client';
import { useEffect, useState } from 'react';

export function PwaRegister() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-center text-xs font-semibold py-1">Offline – Start/Stopp wird gespeichert und später übertragen.</div>;
}
