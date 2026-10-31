import { createPublicKey, verify as verifySignature } from 'crypto';

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

type GoogleJwk = {
  [key: string]: unknown;
  kid?: string;
  alg?: string;
  use?: string;
  kty?: string;
  n?: string;
  e?: string;
};

let jwksCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;

async function getGoogleKeys(): Promise<GoogleJwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cache: 'no-store' });
  if (!response.ok) throw new Error('Google sign-in verification is temporarily unavailable.');

  const payload = (await response.json()) as { keys?: GoogleJwk[] };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('Google did not return signing keys.');
  }

  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys: payload.keys, expiresAt: Date.now() + Math.max(60, maxAge) * 1000 };
  return payload.keys;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in is not configured on this server.');

  const [encodedHeader, encodedPayload, encodedSignature, ...extra] = idToken.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra.length) {
    throw new Error('Invalid Google credential.');
  }

  let header: { alg?: string; kid?: string };
  let claims: GoogleProfile & { aud?: string | string[]; iss?: string; exp?: number; iat?: number };
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid Google credential.');
  }

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Google credential.');
  let keys = await getGoogleKeys();
  let key = keys.find((candidate) => candidate.kid === header.kid);
  if (!key) {
    jwksCache = null;
    keys = await getGoogleKeys();
    key = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!key) throw new Error('Google credential signing key was not found.');

  const publicKey = createPublicKey({ key, format: 'jwk' });
  const signedContent = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = Buffer.from(encodedSignature, 'base64url');
  if (!verifySignature('RSA-SHA256', signedContent, publicKey, signature)) {
    throw new Error('Google credential signature is invalid.');
  }

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches = Array.isArray(claims.aud)
    ? claims.aud.includes(clientId)
    : claims.aud === clientId;
  if (
    !audienceMatches ||
    !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss || '') ||
    !claims.exp || claims.exp <= now ||
    !claims.iat || claims.iat > now + 60 ||
    !claims.sub ||
    !claims.email ||
    claims.email_verified !== true
  ) {
    throw new Error('Google credential is expired or does not belong to a verified account.');
  }

  return claims;
}

export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleProfile> {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    throw new Error('Google sign-in is not configured on this server.');
  }
  if (!accessToken || accessToken.length > 8192) throw new Error('Invalid Google access token.');

  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Google access token is invalid or expired.');

  const profile = (await response.json()) as GoogleProfile;
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    throw new Error('Google did not verify this account email.');
  }
  return profile;
}
