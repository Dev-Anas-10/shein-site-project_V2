import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth-security';

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearSessionCookie(res);
  return res;
}
