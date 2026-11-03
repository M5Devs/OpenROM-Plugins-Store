import type { APIRoute } from 'astro';
import { buildAuthorizeUrl, callbackUrlFor, getGitHubCredentials } from '../../../lib/github';

export const prerender = false;

const STATE_COOKIE = 'openrom_oauth_state';
const STATE_TTL_SECONDS = 600; // the round-trip to GitHub is quick; 10 minutes is ample

/**
 * Kick off the GitHub OAuth dance.
 *
 * A random `state` value is stored in a short-lived HttpOnly cookie and echoed to
 * GitHub. The callback refuses to continue unless the two match, which blocks
 * cross-site login-CSRF.
 */
export const GET: APIRoute = ({ request, cookies, locals, redirect }) => {
  const credentials = getGitHubCredentials(locals.runtime?.env);
  if (!credentials) {
    return new Response('GitHub OAuth is not configured on this deployment.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const state = crypto.randomUUID();
  const url = new URL(request.url);
  cookies.set(STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: STATE_TTL_SECONDS,
  });

  return redirect(buildAuthorizeUrl(credentials.clientId, callbackUrlFor(url), state), 302);
};
