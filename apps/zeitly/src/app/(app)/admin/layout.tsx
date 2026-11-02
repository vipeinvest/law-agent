import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireSession, isManagerOrAbove } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireSession();
  if (!isManagerOrAbove(s.user) && s.user.role !== 'payroll') redirect('/app');
  return <>{children}</>;
}
