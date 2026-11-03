/**
 * D1 access layer for GitHub accounts.
 *
 * `github_id` is the stable identity key: a user may rename their GitHub handle,
 * but the numeric id never changes, so it — not the username — anchors every
 * foreign key. The username is refreshed on each login.
 */

export interface UserRow {
  id: number;
  github_id: string;
  github_username: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface User {
  githubId: string;
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GitHubProfile {
  id: number | string;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

export function toUser(row: UserRow): User {
  return {
    githubId: row.github_id,
    githubUsername: row.github_username,
    name: row.name,
    avatarUrl: row.avatar_url,
  };
}

/** Insert the account, or refresh its mutable fields if it already exists. */
export async function upsertUser(db: D1Database, profile: GitHubProfile): Promise<UserRow> {
  const githubId = String(profile.id);
  const row = await db
    .prepare(
      `INSERT INTO users (github_id, github_username, name, avatar_url)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (github_id) DO UPDATE SET
         github_username = excluded.github_username,
         name            = excluded.name,
         avatar_url      = excluded.avatar_url
       RETURNING *`,
    )
    .bind(githubId, profile.login, profile.name ?? null, profile.avatar_url ?? null)
    .first<UserRow>();

  if (!row) {
    throw new Error('Failed to persist GitHub user record.');
  }
  return row;
}

export async function getUserByGithubId(
  db: D1Database,
  githubId: string,
): Promise<UserRow | null> {
  return db
    .prepare('SELECT * FROM users WHERE github_id = ?')
    .bind(githubId)
    .first<UserRow>();
}
