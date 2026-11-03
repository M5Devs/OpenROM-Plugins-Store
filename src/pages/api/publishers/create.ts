import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { getSessionUser, jsonResponse } from '../../../lib/auth';
import {
  createPublisher,
  getPublisher,
  validatePublisherId,
  validatePublisherName,
} from '../../../lib/publishers';

export const prerender = false;

/**
 * Register a publisher owned by the signed-in GitHub account.
 *
 * The slug is validated, checked for uniqueness, and `verified` is derived from the
 * auto-verify rule (`slug === github_username`) rather than trusted from the client.
 */
export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const session = await getSessionUser(context);
  if (!session) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  let body: { id?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Expected a JSON body.' }, 400);
  }

  const idError = validatePublisherId(body.id);
  if (idError) return jsonResponse({ error: idError }, 400);
  const nameError = validatePublisherName(body.name);
  if (nameError) return jsonResponse({ error: nameError }, 400);

  const id = (body.id as string).trim();
  const name = (body.name as string).trim();

  const db = getDB(locals);

  const existing = await getPublisher(db, id);
  if (existing) {
    return jsonResponse({ error: `Publisher "${id}" already exists.` }, 409);
  }

  try {
    const publisher = await createPublisher(db, {
      id,
      name,
      ownerGithubId: session.githubId,
      githubUsername: session.githubUsername,
    });
    return jsonResponse({ publisher, verified: publisher.verified }, 201);
  } catch (error) {
    console.error('Failed to create publisher', error);
    return jsonResponse({ error: 'Could not create the publisher.' }, 500);
  }
};
