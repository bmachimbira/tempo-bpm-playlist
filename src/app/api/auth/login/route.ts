import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { buildAuthorizeUrl } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set('sp_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
