import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-security';

export async function POST(req: NextRequest) {
  try {
    const existingSession = await getRequestSession(req);
    if (existingSession) {
      return NextResponse.json({ success: true, session: existingSession });
    }

    // A userId/email pair from localStorage is not proof of identity.
    return NextResponse.json({ error: 'Sign in again to refresh your session.' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Session sync failed' }, { status: 500 });
  }
}
