'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { CalendarDays, CalendarRange, ClipboardCheck, Clock, Download, FileSpreadsheet, FolderKanban, LayoutDashboard, LogOut, Palmtree, Settings, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import type { NavItem } from './nav-items';
const ICONS = { clock: Clock, week: CalendarRange, month: CalendarDays, palm: Palmtree, user: UserRound, dash: LayoutDashboard, users: Users, approvals: ClipboardCheck, projects: FolderKanban, export: Download, import: FileSpreadsheet, settings: Settings, audit: ShieldCheck };

function isActive(pathname: string, href: string): boolean {
  if (href === '/app' || href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function SideNav({ items, brand, user, switchTo }: { items: NavItem[]; brand: ReactNode; user: { name: string; email: string; roleLabel: string }; switchTo?: { href: string; label: string } }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line bg-card min-h-dvh sticky top-0 h-dvh">
      <div className="p-4 border-b border-line">{brand}</div>
      <nav className="p-2 flex-1 overflow-auto">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(pathname, it.href);
          return (
            <Link key={it.href} href={it.href} className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5', active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-black/5')}>
              <Icon className="w-5 h-5" />
              <span className="flex-1">{it.label}</span>
              {it.badge ? <span className="badge bg-accent text-white">{it.badge}</span> : null}
            </Link>
          );
        })}
        {switchTo && (
          <Link href={switchTo.href} className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-black/5 border border-dashed border-line">
            <Clock className="w-5 h-5" /> {switchTo.label}
          </Link>
        )}
      </nav>
      <div className="p-3 border-t border-line text-sm">
        <div className="font-medium truncate">{user.name}</div>
        <div className="text-xs text-muted truncate">{user.roleLabel}</div>
        <form action="/api/auth/logout" method="post" className="mt-2">
          <button className="btn-ghost btn-sm w-full justify-start text-muted">
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const shown = items.slice(0, 5);
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-line safe-bottom no-print">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(pathname, it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} className={clsx('flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium relative', active ? 'text-brand' : 'text-muted')}>
                <Icon className="w-5 h-5" />
                {it.label}
                {it.badge ? <span className="absolute top-1 right-1/4 badge bg-accent text-white px-1.5">{it.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopBar({ brand, title, right }: { brand: ReactNode; title?: string; right?: ReactNode }) {
  return (
    <header className="md:hidden sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-line px-4 h-14 flex items-center justify-between no-print">
      <div className="flex items-center gap-3 min-w-0">
        {brand}
        {title && <span className="text-sm font-semibold truncate">{title}</span>}
      </div>
      {right}
    </header>
  );
}
