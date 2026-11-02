export interface NavItem {
  href: string;
  label: string;
  icon: 'clock' | 'week' | 'month' | 'palm' | 'user' | 'dash' | 'users' | 'approvals' | 'projects' | 'export' | 'import' | 'settings' | 'audit' | 'plan';
  badge?: number;
}

export function employeeNav(): NavItem[] {
  return [
    { href: '/app', label: 'Heute', icon: 'clock' },
    { href: '/app/woche', label: 'Woche', icon: 'week' },
    { href: '/app/monat', label: 'Monat', icon: 'month' },
    { href: '/app/abwesenheiten', label: 'Abwesenheit', icon: 'palm' },
    { href: '/app/profil', label: 'Profil', icon: 'user' },
  ];
}
export function adminNav(role: string, pending = 0): NavItem[] {
  const items: NavItem[] = [
    { href: '/admin', label: 'Team', icon: 'dash' },
    { href: '/admin/freigaben', label: 'Freigaben', icon: 'approvals', badge: pending },
    { href: '/admin/dienstplan', label: 'Dienstplan', icon: 'plan' },
    { href: '/admin/export', label: 'Export', icon: 'export' },
  ];
  if (role === 'owner' || role === 'admin') {
    items.push({ href: '/admin/mitarbeiter', label: 'Mitarbeiter', icon: 'users' }, { href: '/admin/projekte', label: 'Projekte', icon: 'projects' }, { href: '/admin/import', label: 'Import', icon: 'import' }, { href: '/admin/einstellungen', label: 'Einstellungen', icon: 'settings' }, { href: '/admin/protokoll', label: 'Protokoll', icon: 'audit' });
  }
  return items;
}
