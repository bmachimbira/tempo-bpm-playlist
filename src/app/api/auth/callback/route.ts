import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getCurrentUser } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { code, state } = await req.json();
    const expectedState = req.cookies.get('sp_state')?.value;
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    if (!expectedState || state !== expectedState) {
      return NextResponse.json({ error: 'State mismatch. Try logging in again.' }, { status: 400 });
    }

    const tokens = await exchangeCodeForToken(code);
    const user = await getCurrentUser(tokens.access_token);

    const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.display_name } });
    const secure = process.env.NODE_ENV === 'production';
    res.cookies.set('sp_access', tokens.access_token, {
      httpOnly: true, sameSite: 'lax', path: '/', secure,
      maxAge: tokens.expires_in,
    });
    res.cookies.set('sp_refresh', tokens.refresh_token, {
      httpOnly: true, sameSite: 'lax', path: '/', secure,
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set('sp_user', encodeURIComponent(user.display_name || user.id), {
      sameSite: 'lax', path: '/', secure, maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set('sp_state', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Auth failed' },
      { status: 500 },
    );
  }
}
