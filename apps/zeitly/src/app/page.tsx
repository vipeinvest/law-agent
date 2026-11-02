import { redirect } from 'next/navigation';
import { getSession, isManagerOrAbove } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Index() {
  const s = await getSession();
  if (!s) redirect('/login');
  redirect(isManagerOrAbove(s.user) && s.user.role !== 'manager' ? '/admin' : '/app');
}
