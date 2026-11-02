import type { APIRoute } from 'astro';
import { getDB, incrementDownloads } from '../../../lib/db';

export const prerender = false;

/**
 * Real download tracking. Atomically increments the extension's counter and then
 * hands the visitor off to the hosted bundle. Responses are never cached so every
 * click is counted exactly once.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const id = params.id;
  if (!id) {
    return new Response('Missing extension id', { status: 400 });
  }

  let target: string | null;
  try {
    target = await incrementDownloads(getDB(locals), id);
  } catch (error) {
    return new Response(`Download tracking unavailable: ${error}`, { status: 503 });
  }

  if (!target) {
    return new Response(`Extension "${id}" not found`, { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: target, 'Cache-Control': 'no-store' },
  });
};
