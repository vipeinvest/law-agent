import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({ children, className, title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={clsx('card', padded && 'p-4 sm:p-5', className)}>
      {(title || action) && (
        <header className={clsx('flex items-center justify-between gap-3', padded ? 'mb-3' : 'p-4 pb-0')}>
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
  return (
    <div className="card p-3 sm:p-4">
      <div className="text-xs uppercase tracking-wide text-muted font-semibold">{label}</div>
      <div className={clsx('text-xl sm:text-2xl font-bold mt-1 tabular-nums whitespace-nowrap', tone === 'good' && 'text-emerald-700', tone === 'bad' && 'text-red-700', tone === 'warn' && 'text-amber-700')}>{value}</div>
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'gray', className }: { children: ReactNode; tone?: 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'brand'; className?: string }) {
  const tones: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-sky-100 text-sky-800',
    brand: 'bg-brand-soft text-brand',
  };
  return <span className={clsx('badge', tones[tone], className)}>{children}</span>;
}

export function Field({ label, children, hint, htmlFor }: { label: string; children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xl font-bold mb-3">·</div>
      <h3 className="font-semibold">{title}</h3>
      {text && <p className="text-sm text-muted mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: 'error' | 'warn' | 'info' }) {
  return severity === 'error' ? <Badge tone="red">Verstoß</Badge> : severity === 'warn' ? <Badge tone="amber">Hinweis</Badge> : <Badge tone="blue">Info</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin', className)} aria-label="Lädt" />;
}
