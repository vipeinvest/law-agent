import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { destroySession, SESSION_COOKIE } from '@/lib/auth';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST() {
  await destroySession();
  cookies().delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL('/login', env.appUrl), { status: 303 });
}
