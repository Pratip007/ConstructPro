import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  // Clear both auth cookies
  res.cookies.set('atr_token', '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set('atr_refresh', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
