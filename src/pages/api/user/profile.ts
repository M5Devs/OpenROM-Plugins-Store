import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { getSessionUser, jsonResponse } from '../../../lib/auth';
import { updateUserProfile, getUserByGithubId, toUserProfile } from '../../../lib/users';
import { validateImageOrUrl } from '../../../lib/media';
import { AVATAR_LIMITS } from '../../../lib/image';

export const prerender = false;

const NAME_MAX_LENGTH = 80;

function validateName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Display name must be a string.';
  const value = name.trim();
  if (value.length > NAME_MAX_LENGTH) {
    return `Display name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Read the signed-in user's effective profile (custom values overlaid on GitHub).
 */
export const GET: APIRoute = async (context) => {
  const session = await getSessionUser(context);
  if (!session) return jsonResponse({ error: 'Authentication required.' }, 401);

  let row;
  try {
    row = await getUserByGithubId(getDB(context.locals), session.githubId);
  } catch (error) {
    console.error('Failed to read user profile', error);
    return jsonResponse({ error: 'Your profile is temporarily unavailable.' }, 503);
  }
  return jsonResponse({ profile: toUserProfile(session, row) });
};

/**
 * Update the signed-in user's own profile: display name and avatar.
 *
 * The avatar may be an uploaded image (a base64 data URL from the client optimizer)
 * or an absolute http(s) URL; an empty avatar clears it and falls back to the GitHub
 * avatar. Saving sets `profile_customized`, which stops future logins from
 * overwriting the user's own values.
 */
export const PATCH: APIRoute = async (context) => {
  const session = await getSessionUser(context);
  if (!session) return jsonResponse({ error: 'Authentication required.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Expected a JSON body.' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonResponse({ error: 'Expected a JSON object.' }, 400);
  }

  let db: D1Database;
  let existing;
  try {
    db = getDB(context.locals);
    existing = await getUserByGithubId(db, session.githubId);
  } catch (error) {
    console.error('Failed to read user profile', error);
    return jsonResponse({ error: 'Your profile is temporarily unavailable.' }, 503);
  }
  if (!existing) {
    return jsonResponse({ error: 'Your account could not be found. Try signing in again.' }, 404);
  }

  // Start from the current effective values, then apply only the fields sent.
  const name = 'name' in body ? body.name : (existing.name ?? session.githubUsername);
  const avatarUrl = 'avatarUrl' in body ? body.avatarUrl : (existing.avatar_url ?? '');

  const nameError = validateName(name);
  if (nameError) return jsonResponse({ error: nameError }, 400);

  const avatarError = validateImageOrUrl(avatarUrl, 'Avatar', AVATAR_LIMITS);
  if (avatarError) return jsonResponse({ error: avatarError }, 400);

  const updated = await updateUserProfile(db, session.githubId, {
    name: (name as string).trim(),
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : '',
  });
  if (!updated) {
    return jsonResponse({ error: 'Could not save your profile.' }, 500);
  }

  return jsonResponse({ profile: toUserProfile(session, updated) });
};
