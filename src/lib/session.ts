/**
 * Stateless session tokens backed by an HMAC-SHA256 signed cookie.
 *
 * The payload is the public GitHub profile plus an issued-at timestamp — it holds
 * no secret, so it is only encoded, not encrypted; the HMAC is what makes it
 * tamper-proof. Signing and verification use the Web Crypto API, which is available
 * on the Cloudflare Workers runtime and in Node, so the same code runs everywhere.
 *
 * The signing secret comes from `SESSION_SECRET`, falling back to
 * `GITHUB_CLIENT_SECRET`. Sessions are rejected outright if neither is configured.
 */

export const SESSION_COOKIE = 'openrom_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  githubId: string;
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface SessionPayload extends SessionUser {
  /** Issued-at, in seconds since the Unix epoch. */
  iat: number;
}

/** Minimal environment shape; the Cloudflare `Env` and Node `process.env` both fit. */
export interface SessionEnv {
  SESSION_SECRET?: string;
  GITHUB_CLIENT_SECRET?: string;
}

function resolveSecret(env: SessionEnv | undefined): string | null {
  const secret = env?.SESSION_SECRET ?? env?.GITHUB_CLIENT_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

/** Constant-time comparison so token verification cannot be timed. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Produce a `<payload>.<signature>` token, or `null` when no secret is configured. */
export async function createSessionToken(
  user: SessionUser,
  env: SessionEnv | undefined,
  now: number = Date.now(),
): Promise<string | null> {
  const secret = resolveSecret(env);
  if (!secret) return null;

  const payload: SessionPayload = {
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    name: user.name,
    avatarUrl: user.avatarUrl,
    iat: Math.floor(now / 1000),
  };
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encoded, secret);
  return `${encoded}.${signature}`;
}

/** Verify a token and return its payload, or `null` for any malformed/forged/expired value. */
export async function verifySessionToken(
  token: string | undefined | null,
  env: SessionEnv | undefined,
  now: number = Date.now(),
): Promise<SessionPayload | null> {
  const secret = resolveSecret(env);
  if (!secret || !token) return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let expected: string;
  try {
    expected = await sign(encoded, secret);
  } catch {
    return null;
  }
  if (!timingSafeEqual(signature, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encoded)));
  } catch {
    return null;
  }

  if (
    typeof payload?.githubId !== 'string' ||
    typeof payload?.githubUsername !== 'string' ||
    typeof payload?.iat !== 'number'
  ) {
    return null;
  }

  const age = Math.floor(now / 1000) - payload.iat;
  if (age < 0 || age > SESSION_TTL_SECONDS) return null;

  return payload;
}
