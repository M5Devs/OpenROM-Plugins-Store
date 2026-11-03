import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { getSessionUser, jsonResponse } from '../../../lib/auth';
import { getPublisherProfile } from '../../../lib/publisher-profile';
import { validateImageOrUrl } from '../../../lib/media';
import { AVATAR_LIMITS, BANNER_LIMITS, type ImageLimits } from '../../../lib/image';
import {
  getPublisher,
  updatePublisherProfile,
  validateBio,
  validateOptionalUrl,
  validatePublisherId,
  validatePublisherName,
  type Publisher,
  type PublisherProfileInput,
} from '../../../lib/publishers';

export const prerender = false;

/** Read the profile: publisher record, live aggregates, and its extensions. */
export const GET: APIRoute = async (context) => {
  const id = context.params.id ?? '';
  const idError = validatePublisherId(id);
  if (idError) return jsonResponse({ error: idError }, 400);

  const profile = await getPublisherProfile(getDB(context.locals), id);
  if (!profile) return jsonResponse({ error: `Publisher "${id}" was not found.` }, 404);

  return jsonResponse(profile);
};

type EditableField = {
  key: keyof PublisherProfileInput;
  /** Mutates the draft, or returns a validation error message. */
  apply: (value: unknown, draft: PublisherProfileInput) => string | null;
};

/**
 * Media fields accept either an uploaded image (a data URL from the client
 * optimizer) or a plain URL, so they get the stricter image-aware validator with
 * per-field dimension limits; the social links are URL-only.
 */
const MEDIA_FIELDS: Array<{ key: keyof PublisherProfileInput; label: string; limits: ImageLimits }> =
  [
    { key: 'avatarUrl', label: 'Avatar', limits: AVATAR_LIMITS },
    { key: 'bannerUrl', label: 'Banner', limits: BANNER_LIMITS },
  ];

const URL_FIELDS: Array<{ key: keyof PublisherProfileInput; label: string }> = [
  { key: 'websiteUrl', label: 'Website' },
  { key: 'githubUrl', label: 'GitHub URL' },
  { key: 'discordUrl', label: 'Discord URL' },
  { key: 'twitterUrl', label: 'Twitter/X URL' },
];

const EDITABLE_FIELDS: EditableField[] = [
  {
    key: 'name',
    apply: (value, draft) => {
      const error = validatePublisherName(value);
      if (error) return error;
      draft.name = (value as string).trim();
      return null;
    },
  },
  {
    key: 'bio',
    apply: (value, draft) => {
      const error = validateBio(value);
      if (error) return error;
      draft.bio = (value as string).trim();
      return null;
    },
  },
  ...MEDIA_FIELDS.map(
    ({ key, label, limits }): EditableField => ({
      key,
      apply: (value, draft) => {
        const error = validateImageOrUrl(value, label, limits);
        if (error) return error;
        draft[key] = (value as string).trim() as never;
        return null;
      },
    }),
  ),
  ...URL_FIELDS.map(
    ({ key, label }): EditableField => ({
      key,
      apply: (value, draft) => {
        const error = validateOptionalUrl(value, label);
        if (error) return error;
        draft[key] = (value as string).trim() as never;
        return null;
      },
    }),
  ),
];

function draftFrom(publisher: Publisher): PublisherProfileInput {
  return {
    name: publisher.name,
    bio: publisher.bio,
    avatarUrl: publisher.avatarUrl,
    bannerUrl: publisher.bannerUrl,
    websiteUrl: publisher.websiteUrl,
    githubUrl: publisher.githubUrl,
    discordUrl: publisher.discordUrl,
    twitterUrl: publisher.twitterUrl,
  };
}

/**
 * Update the publisher's branding. Only the owner may edit, and only the fields in
 * `EDITABLE_FIELDS` are honoured — `id`, `verified`, and `owner_github_id` are never
 * taken from the request body.
 */
export const PATCH: APIRoute = async (context) => {
  const id = context.params.id ?? '';
  const idError = validatePublisherId(id);
  if (idError) return jsonResponse({ error: idError }, 400);

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

  const db = getDB(context.locals);
  const publisher = await getPublisher(db, id);
  if (!publisher) return jsonResponse({ error: `Publisher "${id}" was not found.` }, 404);
  if (publisher.ownerGithubId !== session.githubId) {
    return jsonResponse({ error: 'You do not own this publisher.' }, 403);
  }

  const draft = draftFrom(publisher);
  for (const field of EDITABLE_FIELDS) {
    if (!(field.key in body)) continue;
    const error = field.apply(body[field.key], draft);
    if (error) return jsonResponse({ error }, 400);
  }

  const updated = await updatePublisherProfile(db, id, session.githubId, draft);
  if (!updated) {
    return jsonResponse({ error: 'Could not update the publisher.' }, 500);
  }

  return jsonResponse({ publisher: updated });
};
