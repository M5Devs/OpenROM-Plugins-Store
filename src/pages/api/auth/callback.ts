import type { APIRoute } from 'astro';
import {
  callbackUrlFor,
  exchangeCodeForToken,
  fetchGitHubUser,
  getGitHubCredentials,
} from '../../../lib/github';
import { getDB } from '../../../lib/db';
import { upsertUser, sessionUserFromGitHubProfile } from '../../../lib/users';
import { createSessionToken } from '../../../lib/session';
import { setSessionCookie } from '../../../lib/auth';

export const prerender = false;

const STATE_COOKIE = 'openrom_oauth_state';

function fail(message: string, status: number): Response {
  return new Response(message, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Complete the OAuth flow: validate `state`, exchange the `code` for a token, read
 * the GitHub profile, upsert the account into D1, and issue a signed session cookie.
 */
export const GET: APIRoute = async (context) => {
  const { request, cookies, locals } = context;
  const url = new URL(request.url);

  const credentials = getGitHubCredentials(locals.runtime?.env);
  if (!credentials) {
    return fail('GitHub OAuth is not configured on this deployment.', 503);
  }

  // GitHub reports user-facing errors (e.g. denied access) as query parameters.
  if (url.searchParams.get('error')) {
    return context.redirect('/?auth=denied', 302);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies.get(STATE_COOKIE)?.value;
  cookies.delete(STATE_COOKIE, { path: '/' });

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail('Invalid OAuth state. Please start the sign-in flow again.', 400);
  }

  const accessToken = await exchangeCodeForToken(code, credentials, callbackUrlFor(url));
  if (!accessToken) {
    return fail('GitHub rejected the authorization code.', 502);
  }

  const profile = await fetchGitHubUser(accessToken);
  if (!profile) {
    return fail('Could not read your GitHub profile.', 502);
  }

  try {
    await upsertUser(getDB(locals), profile);
  } catch (error) {
    console.error('Failed to persist GitHub user', error);
    return fail('Could not save your account.', 500);
  }

  const token = await createSessionToken(sessionUserFromGitHubProfile(profile), locals.runtime?.env);
  if (!token) {
    return fail('Session signing is not configured on this deployment.', 500);
  }

  setSessionCookie(cookies, token, url.protocol === 'https:');
  return context.redirect('/dashboard', 302);
};
