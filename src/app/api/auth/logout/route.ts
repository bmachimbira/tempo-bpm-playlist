import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const c of ['sp_access', 'sp_refresh', 'sp_user']) {
    res.cookies.set(c, '', { path: '/', maxAge: 0 });
  }
  return res;
}
