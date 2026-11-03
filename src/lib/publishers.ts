/**
 * D1 access layer and validation for publisher profiles.
 *
 * The only way a publisher can become verified is the auto-verify rule below:
 * its slug must match the owner's GitHub username. There is no API path that lets
 * a user set `verified` directly, which keeps the badge meaningful.
 *
 * Everything else on a publisher — display name, bio, avatar, banner, and the four
 * social links — is owner-editable branding; those are the fields migration 0003 adds.
 */

export interface PublisherRow {
  id: string;
  name: string;
  owner_github_id: string;
  verified: number;
  created_at: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  github_url: string | null;
  discord_url: string | null;
  twitter_url: string | null;
}

export interface Publisher {
  id: string;
  name: string;
  ownerGithubId: string;
  verified: boolean;
  createdAt: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  websiteUrl: string;
  githubUrl: string;
  discordUrl: string;
  twitterUrl: string;
}

export function toPublisher(row: PublisherRow): Publisher {
  return {
    id: row.id,
    name: row.name,
    ownerGithubId: row.owner_github_id,
    verified: Boolean(row.verified),
    createdAt: row.created_at,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
    bannerUrl: row.banner_url ?? '',
    websiteUrl: row.website_url ?? '',
    githubUrl: row.github_url ?? '',
    discordUrl: row.discord_url ?? '',
    twitterUrl: row.twitter_url ?? '',
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

export const BIO_MAX_LENGTH = 600;
export const URL_MAX_LENGTH = 300;

export function validateBio(bio: unknown): string | null {
  if (typeof bio !== 'string') {
    return 'Bio must be a string.';
  }
  if (bio.length > BIO_MAX_LENGTH) {
    return `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Only absolute `http(s)` URLs are accepted. This blocks `javascript:`/`data:` and
 * other schemes that would otherwise be rendered into an `href`/`src` on the profile.
 */
export function validateOptionalUrl(value: unknown, label: string): string | null {
  if (typeof value !== 'string') {
    return `${label} must be a string.`;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > URL_MAX_LENGTH) {
    return `${label} must be ${URL_MAX_LENGTH} characters or fewer.`;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return `${label} must be a valid URL.`;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `${label} must be an http(s) URL.`;
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

export interface PublisherProfileInput {
  name: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  websiteUrl: string;
  githubUrl: string;
  discordUrl: string;
  twitterUrl: string;
}

/**
 * Update a publisher's branding fields. Ownership is checked by the caller; the
 * `owner_github_id` predicate here is a second guard so a mismatch updates nothing.
 */
export async function updatePublisherProfile(
  db: D1Database,
  id: string,
  ownerGithubId: string,
  input: PublisherProfileInput,
): Promise<Publisher | null> {
  const row = await db
    .prepare(
      `UPDATE publishers SET
         name        = ?1,
         bio         = ?2,
         avatar_url  = ?3,
         banner_url  = ?4,
         website_url = ?5,
         github_url  = ?6,
         discord_url = ?7,
         twitter_url = ?8
       WHERE id = ?9 AND owner_github_id = ?10
       RETURNING *`,
    )
    .bind(
      input.name,
      input.bio,
      input.avatarUrl,
      input.bannerUrl,
      input.websiteUrl,
      input.githubUrl,
      input.discordUrl,
      input.twitterUrl,
      id,
      ownerGithubId,
    )
    .first<PublisherRow>();

  return row ? toPublisher(row) : null;
}
