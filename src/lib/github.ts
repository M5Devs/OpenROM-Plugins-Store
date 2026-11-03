/**
 * Thin client for the two GitHub endpoints the OAuth flow needs.
 *
 * Credentials are read from the Cloudflare runtime environment, never hard-coded.
 * GitHub requires a `User-Agent` header on API requests, and the token exchange
 * must ask for JSON explicitly or GitHub answers with a form-encoded body.
 */

export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_USER_URL = 'https://api.github.com/user';

export interface GitHubEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export interface GitHubCredentials {
  clientId: string;
  clientSecret: string;
}

export function getGitHubCredentials(env: GitHubEnv | undefined): GitHubCredentials | null {
  const clientId = env?.GITHUB_CLIENT_ID;
  const clientSecret = env?.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);
  return url.toString();
}

/** Exchange an authorization `code` for an access token. Returns `null` on failure. */
export async function exchangeCodeForToken(
  code: string,
  credentials: GitHubCredentials,
  redirectUri: string,
): Promise<string | null> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export interface GitHubUser {
  id: number | string;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser | null> {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'openrom-store',
    },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as Partial<GitHubUser>;
  if (data.id === undefined || !data.login) return null;
  return { id: data.id, login: data.login, name: data.name, avatar_url: data.avatar_url };
}

/** The callback URL GitHub should redirect back to, derived from the incoming request. */
export function callbackUrlFor(requestUrl: URL): string {
  return new URL('/api/auth/callback', requestUrl.origin).toString();
}
