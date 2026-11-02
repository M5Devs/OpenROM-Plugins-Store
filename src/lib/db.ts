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

export async function listPlugins(db: D1Database): Promise<Plugin[]> {
  const { results } = await db
    .prepare('SELECT * FROM plugins ORDER BY downloads DESC, name ASC')
    .all<PluginRow>();
  return (results ?? []).map(toPlugin);
}

export async function getPlugin(db: D1Database, id: string): Promise<Plugin | null> {
  const row = await db.prepare('SELECT * FROM plugins WHERE id = ?').bind(id).first<PluginRow>();
  return row ? toPlugin(row) : null;
}

/** Atomically bump the real download counter. Returns the target URL, if known. */
export async function incrementDownloads(db: D1Database, id: string): Promise<string | null> {
  const row = await db
    .prepare('UPDATE plugins SET downloads = downloads + 1 WHERE id = ? RETURNING download_url')
    .bind(id)
    .first<{ download_url: string }>();
  return row?.download_url ?? null;
}
