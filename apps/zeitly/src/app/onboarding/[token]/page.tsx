import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/db/client';
import { resolveToken } from '@/lib/onboarding';
import { ApiError } from '@/lib/api';
import { orgTheme } from '@/lib/org';
import { BrandMark, ThemeStyle } from '@/components/theme';
import { OnboardingWizard } from './Wizard';

export const metadata: Metadata = { title: 'Onboarding' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage({ params }: { params: { token: string } }) {
  const db = await getDb();
  let error: string | null = null;
  let ctx: Awaited<ReturnType<typeof resolveToken>> | null = null;
  try {
    ctx = await resolveToken(db, params.token);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Link ungültig.';
  }
  if (!ctx) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6 bg-paper">
        <div className="card p-6 max-w-sm text-center">
          <h1 className="text-lg font-bold mb-2">Link nicht gültig</h1>
          <p className="text-sm text-muted">{error}</p>
          <Link href="/login" className="btn-secondary btn-sm mt-4">
            Zur Anmeldung
          </Link>
        </div>
      </main>
    );
  }
  const theme = orgTheme(ctx.org);
  const appName = (ctx.org.theme as { appName?: string })?.appName || ctx.org.name;
  return (
    <main className="min-h-dvh bg-paper">
      <ThemeStyle theme={theme} />
      <header className="bg-card border-b border-line">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <BrandMark theme={theme} orgName={appName} size="sm" />
          <span className="text-xs text-muted">Onboarding · {ctx.org.name}</span>
        </div>
      </header>
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <OnboardingWizard token={params.token} />
      </div>
    </main>
  );
}
