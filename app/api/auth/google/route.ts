import { NextRequest, NextResponse } from 'next/server';
import { db, DuplicateUserError } from '@/lib/db';
import { User } from '@/lib/types';
import { createSessionToken, setSessionCookie } from '@/lib/auth-security';
import { verifyGoogleAccessToken, verifyGoogleIdToken, type GoogleProfile } from '@/lib/google-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body.idToken !== 'string' && typeof body.accessToken !== 'string') {
      return NextResponse.json(
        { error: 'A Google credential is required.' },
        { status: 400 }
      );
    }

    let profile: GoogleProfile;
    try {
      profile = typeof body.idToken === 'string'
        ? await verifyGoogleIdToken(body.idToken)
        : await verifyGoogleAccessToken(body.accessToken);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Google credential could not be verified.' },
        { status: 401 }
      );
    }

    const email = profile.email.trim().toLowerCase();
    const name = profile.name?.trim() || email.split('@')[0];
    const avatar =
      profile.picture ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

    let user = await db.getUserByEmail(email);
    const now = new Date().toISOString();

    if (!user) {
      // Create user if signing in with Google for the first time
      const newUser: User = {
        id: `google-${profile.sub}`,
        name,
        email,
        role: 'user',
        avatar,
        phone: '',
        createdAt: now,
        lastLoginAt: now,
      };
      try {
        user = await db.createUser(newUser);
      } catch (error) {
        if (!(error instanceof DuplicateUserError)) throw error;
        user = await db.getUserByEmail(email);
        if (!user) throw error;
        await db.recordUserLogin(user.id);
      }
    } else {
      await db.recordUserLogin(user.id);
      user.lastLoginAt = now;
    }

    const { password, ...safeUser } = user;
    safeUser.lastLoginAt = user.lastLoginAt;

    const token = createSessionToken(safeUser);
    const res = NextResponse.json({
      success: true,
      message: 'Logged in with Google successfully',
      data: safeUser,
      token,
    });

    setSessionCookie(res, token);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Google sign-in failed.' }, { status: 500 });
  }
}
