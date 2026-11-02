import type { APIRoute } from 'astro';
import { getDB, listPlugins } from '../../lib/db';

export const prerender = false;

/**
 * Live catalog. Reads every row straight from D1 — the database is the source of
 * truth, so a newly published extension appears here without a redeploy.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const plugins = await listPlugins(getDB(locals));
    return new Response(JSON.stringify(plugins, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Catalog unavailable', detail: String(error) }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }
};
