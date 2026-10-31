import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie, getRequestSession } from '@/lib/auth-security';

export async function POST(req: NextRequest) {
  try {
    // 1. If already valid session, return it
    const existingSession = await getRequestSession(req);
    if (existingSession) {
      return NextResponse.json({ success: true, session: existingSession });
    }

    // 2. Otherwise verify user identity from DB
    const body = await req.json();
    const { userId, email } = body || {};

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 });
    }

    const user = await db.getUserById(userId);
    if (!user || user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Invalid user session' }, { status: 401 });
    }

    const token = createSessionToken(user);
    const res = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });

    setSessionCookie(res, token);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Session sync failed' }, { status: 500 });
  }
}
