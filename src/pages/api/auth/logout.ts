import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';

export const prerender = false;

/** Clear the session cookie and send the visitor home. */
export const POST: APIRoute = (context) => {
  clearSessionCookie(context.cookies);
  return context.redirect('/', 303);
};
