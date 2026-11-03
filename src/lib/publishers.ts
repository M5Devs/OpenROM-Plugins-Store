/**
 * D1 access layer and validation for publisher profiles.
 *
 * The only way a publisher can become verified is the auto-verify rule below:
 * its slug must match the owner's GitHub username. There is no API path that lets
 * a user set `verified` directly, which keeps the badge meaningful.
 */

export interface PublisherRow {
  id: string;
  name: string;
  owner_github_id: string;
  verified: number;
  created_at: string;
}

export interface Publisher {
  id: string;
  name: string;
  ownerGithubId: string;
  verified: boolean;
  createdAt: string;
}

export function toPublisher(row: PublisherRow): Publisher {
  return {
    id: row.id,
    name: row.name,
    ownerGithubId: row.owner_github_id,
    verified: Boolean(row.verified),
    createdAt: row.created_at,
  };
}

export const PUBLISHER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PUBLISHER_ID_MAX_LENGTH = 39;

/** Lowercase alphanumeric words separated by single hyphens, no leading/trailing hyphen. */
export function validatePublisherId(id: unknown): string | null {
  if (typeof id !== 'string') {
    return 'Publisher id must be a string.';
  }
  const value = id.trim();
  if (value.length < 2 || value.length > PUBLISHER_ID_MAX_LENGTH) {
    return `Publisher id must be between 2 and ${PUBLISHER_ID_MAX_LENGTH} characters.`;
  }
  if (!PUBLISHER_ID_PATTERN.test(value)) {
    return 'Publisher id may only contain lowercase letters, numbers, and hyphens (no leading, trailing, or repeated hyphens).';
  }
  return null;
}

export function validatePublisherName(name: unknown): string | null {
  if (typeof name !== 'string') {
    return 'Publisher name must be a string.';
  }
  const value = name.trim();
  if (value.length < 2 || value.length > 80) {
    return 'Publisher name must be between 2 and 80 characters.';
  }
  return null;
}

/** Auto-verify: a slug that matches the owner's GitHub username is the user's own identity. */
export function isVerifiableFor(slug: string, githubUsername: string): boolean {
  return slug.trim().toLowerCase() === githubUsername.trim().toLowerCase();
}

export async function listPublishersForOwner(
  db: D1Database,
  githubId: string,
): Promise<Publisher[]> {
  const { results } = await db
    .prepare('SELECT * FROM publishers WHERE owner_github_id = ? ORDER BY created_at DESC')
    .bind(githubId)
    .all<PublisherRow>();
  return (results ?? []).map(toPublisher);
}

export async function getPublisher(db: D1Database, id: string): Promise<Publisher | null> {
  const row = await db
    .prepare('SELECT * FROM publishers WHERE id = ?')
    .bind(id)
    .first<PublisherRow>();
  return row ? toPublisher(row) : null;
}

export interface CreatePublisherInput {
  id: string;
  name: string;
  ownerGithubId: string;
  githubUsername: string;
}

/**
 * Insert a publisher owned by `ownerGithubId`. `verified` is derived here — never
 * passed in by the caller — so the auto-verify rule cannot be bypassed.
 */
export async function createPublisher(
  db: D1Database,
  input: CreatePublisherInput,
): Promise<Publisher> {
  const verified = isVerifiableFor(input.id, input.githubUsername) ? 1 : 0;
  const row = await db
    .prepare(
      `INSERT INTO publishers (id, name, owner_github_id, verified)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(input.id, input.name, input.ownerGithubId, verified)
    .first<PublisherRow>();

  if (!row) {
    throw new Error('Failed to create publisher.');
  }
  return toPublisher(row);
}
