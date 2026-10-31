import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const SALT_ROUNDS = 10;

export const SESSION_COOKIE_NAME = 'shein_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'shein-concierge-secure-secret-key-prod-2026';

export interface AuthSession {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  name?: string;
  iat: number;
  exp: number;
}

/**
 * Hash a plain text password with salted bcrypt
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Check if a stored string is already a valid bcrypt hash
 */
export function isBcryptHash(value?: string | null): boolean {
  if (!value) return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/**
 * Verify a candidate password against a stored password or hash.
 * If the stored password is plain-text and matches, flags needsRehash=true
 * so the system can transparently upgrade it to a bcrypt hash.
 */
export async function verifyPassword(
  candidate: string,
  stored?: string | null
): Promise<{ isValid: boolean; needsRehash: boolean }> {
  if (!stored || !candidate) {
    return { isValid: false, needsRehash: false };
  }

  if (isBcryptHash(stored)) {
    const isValid = await bcrypt.compare(candidate, stored);
    return { isValid, needsRehash: false };
  }

  // Fallback for legacy / initial plain-text entries
  const isValid = candidate === stored;
  return {
    isValid,
    needsRehash: isValid, // Upgrade to bcrypt hash upon successful match
  };
}

/**
 * Generate a cryptographically signed HMAC-SHA256 session token
 */
export function createSessionToken(
  user: { id: string; email: string; role?: string; name?: string },
  maxAgeSeconds = 7 * 24 * 60 * 60
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthSession = {
    userId: user.id,
    email: user.email.toLowerCase().trim(),
    role: user.role === 'admin' ? 'admin' : 'user',
    name: user.name,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

/**
 * Verify a cryptographically signed session token using constant-time comparison
 */
export function verifySessionToken(token?: string | null): AuthSession | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [pB64, pSig] = parts;

  try {
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(pB64).digest('base64url');
    const sigBuf = Buffer.from(pSig);
    const expBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(pB64, 'base64url').toString('utf8');
    const payload: AuthSession = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);

    if (!payload.userId || !payload.exp || payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify an authenticated session from incoming NextRequest
 */
export async function getRequestSession(req: NextRequest): Promise<AuthSession | null> {
  // 1. Check HTTP-only cookie
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionFromCookie = verifySessionToken(cookieToken);
  if (sessionFromCookie) return sessionFromCookie;

  // 2. Check Authorization header: Bearer <token>
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const sessionFromBearer = verifySessionToken(token);
    if (sessionFromBearer) return sessionFromBearer;
  }

  // 3. Check custom header x-session-token
  const customHeaderToken = req.headers.get('x-session-token');
  const sessionFromCustom = verifySessionToken(customHeaderToken);
  if (sessionFromCustom) return sessionFromCustom;

  // 4. Optional automation admin key for CLI or trusted backend jobs
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey && process.env.ADMIN_API_KEY && adminKey === process.env.ADMIN_API_KEY) {
    const now = Math.floor(Date.now() / 1000);
    return {
      userId: 'system-admin',
      email: 'admin@sheinextract.com',
      role: 'admin',
      name: 'System Admin',
      iat: now,
      exp: now + 3600,
    };
  }

  return null;
}

/**
 * Require valid administrator session or return an immediate 401/403 response
 */
export async function requireAdminSession(
  req: NextRequest
): Promise<{ authorized: true; session: AuthSession } | { authorized: false; response: NextResponse }> {
  const session = await getRequestSession(req);

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      ),
    };
  }

  if (session.role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden: Administrator privileges required.' },
        {
          status: 403,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      ),
    };
  }

  return { authorized: true, session };
}

/**
 * Set HTTP-only, secure, SameSite=Lax session cookie on NextResponse
 */
export function setSessionCookie(res: NextResponse, token: string, maxAge = 7 * 24 * 60 * 60): void {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

/**
 * Clear session cookie on logout
 */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
