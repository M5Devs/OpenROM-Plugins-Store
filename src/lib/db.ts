/**
 * Typed access layer for the Cloudflare D1 `DB` binding.
 *
 * Every read/write against the catalog goes through here so the API endpoints and
 * pages share one shape. The database is the single source of truth — there is no
 * bundled fallback catalog.
 */

/** Raw row as stored in D1. */
export interface PluginRow {
  id: string;
  name: string;
  version: string;
  min_core_version: string;
  publisher_id: string | null;
  publisher_name: string;
  publisher_verified: number;
  category: string;
  description: string;
  readme_markdown: string | null;
  routes_json: string | null;
  platforms_json: string | null;
  download_url: string;
  sha256: string;
  icon: string | null;
  downloads: number;
  created_at: string;
}

/** Normalized shape handed to components and the JSON API. */
export interface Plugin {
  id: string;
  name: string;
  version: string;
  minCoreVersion: string;
  publisherId: string | null;
  publisherName: string;
  publisherVerified: boolean;
  category: string;
  description: string;
  readme: string;
  routes: string[];
  platforms: string[];
  downloadUrl: string;
  sha256: string;
  icon: string;
  downloads: number;
  createdAt: string;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toPlugin(row: PluginRow): Plugin {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    minCoreVersion: row.min_core_version,
    publisherId: row.publisher_id ?? null,
    publisherName: row.publisher_name,
    publisherVerified: Boolean(row.publisher_verified),
    category: row.category,
    description: row.description,
    readme: row.readme_markdown ?? '',
    routes: parseJsonArray(row.routes_json),
    platforms: parseJsonArray(row.platforms_json),
    downloadUrl: row.download_url,
    sha256: row.sha256 ?? '',
    icon: row.icon ?? 'package',
    downloads: row.downloads ?? 0,
    createdAt: row.created_at,
  };
}

/** Resolve the D1 binding from the Cloudflare runtime provided by the adapter. */
export function getDB(locals: App.Locals): D1Database {
  const db = locals.runtime?.env?.DB;
  if (!db) {
    throw new Error(
      'D1 binding "DB" is unavailable. Check the [[d1_databases]] block in wrangler.toml.',
    );
  }
  return db;
}

/**
 * Columns every plugin query selects. Publisher name and verification come from the
 * `publishers` row when the plugin is linked (`publisher_id`); otherwise the
 * denormalized values on the plugin row are used, so legacy rows still render.
 */
const PLUGIN_COLUMNS = `
  p.id, p.name, p.version, p.min_core_version, p.publisher_id,
  COALESCE(pub.name, p.publisher_name)         AS publisher_name,
  COALESCE(pub.verified, p.publisher_verified) AS publisher_verified,
  p.category, p.description, p.readme_markdown, p.routes_json, p.platforms_json,
  p.download_url, p.sha256, p.icon, p.downloads, p.created_at
`;

const PLUGIN_SOURCE = `FROM plugins p LEFT JOIN publishers pub ON pub.id = p.publisher_id`;

export async function listPlugins(db: D1Database): Promise<Plugin[]> {
  const { results } = await db
    .prepare(`SELECT ${PLUGIN_COLUMNS} ${PLUGIN_SOURCE} ORDER BY p.downloads DESC, p.name ASC`)
    .all<PluginRow>();
  return (results ?? []).map(toPlugin);
}

export async function getPlugin(db: D1Database, id: string): Promise<Plugin | null> {
  const row = await db
    .prepare(`SELECT ${PLUGIN_COLUMNS} ${PLUGIN_SOURCE} WHERE p.id = ?`)
    .bind(id)
    .first<PluginRow>();
  return row ? toPlugin(row) : null;
}

/**
 * Match a plugin to a publisher by the explicit `publisher_id` link, falling back
 * to the display name only for rows that predate the link column.
 */
const PUBLISHER_MATCH = `(p.publisher_id = ?1 OR (p.publisher_id IS NULL AND p.publisher_name = ?2))`;

export async function listPluginsByPublisher(
  db: D1Database,
  publisherId: string,
  publisherName: string,
): Promise<Plugin[]> {
  const { results } = await db
    .prepare(
      `SELECT ${PLUGIN_COLUMNS} ${PLUGIN_SOURCE} WHERE ${PUBLISHER_MATCH}
       ORDER BY p.downloads DESC, p.name ASC`,
    )
    .bind(publisherId, publisherName)
    .all<PluginRow>();
  return (results ?? []).map(toPlugin);
}

export interface PublisherStats {
  totalPlugins: number;
  totalDownloads: number;
}

/** Live aggregates for the public profile — summed in D1, never cached in the row. */
export async function getPublisherStats(
  db: D1Database,
  publisherId: string,
  publisherName: string,
): Promise<PublisherStats> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total_plugins, COALESCE(SUM(p.downloads), 0) AS total_downloads
         FROM plugins p
        WHERE ${PUBLISHER_MATCH}`,
    )
    .bind(publisherId, publisherName)
    .first<{ total_plugins: number; total_downloads: number }>();
  return {
    totalPlugins: row?.total_plugins ?? 0,
    totalDownloads: row?.total_downloads ?? 0,
  };
}

/** Atomically bump the real download counter. Returns the target URL, if known. */
export async function incrementDownloads(db: D1Database, id: string): Promise<string | null> {
  const row = await db
    .prepare('UPDATE plugins SET downloads = downloads + 1 WHERE id = ? RETURNING download_url')
    .bind(id)
    .first<{ download_url: string }>();
  return row?.download_url ?? null;
}
