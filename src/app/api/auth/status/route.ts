import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const access = req.cookies.get('sp_access')?.value;
  const refresh = req.cookies.get('sp_refresh')?.value;
  const name = req.cookies.get('sp_user')?.value;
  const loggedIn = Boolean(access || refresh);
  return NextResponse.json({
    loggedIn,
    user: loggedIn && name ? decodeURIComponent(name) : null,
  });
}
