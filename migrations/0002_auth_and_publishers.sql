-- Migration 0002 — GitHub OAuth accounts and publisher ownership.
--
-- `users` holds one row per GitHub account that has signed in. `github_id` is the
-- stable key (GitHub usernames can be renamed); `github_username` is kept in sync
-- on every login and is what the auto-verify rule compares a publisher slug to.
--
-- `publishers` is the canonical publisher record referenced by plugins. Ownership
-- is `owner_github_id` -> users.github_id. `verified` is only ever set to 1 when
-- the publisher slug matches the owner's GitHub username (case-insensitively);
-- nothing else can grant verification.

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id       TEXT UNIQUE NOT NULL,
    github_username TEXT NOT NULL,
    name            TEXT,
    avatar_url      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publishers (
    id              TEXT PRIMARY KEY,                              -- e.g. "nanook", "m5devs"
    name            TEXT NOT NULL,
    owner_github_id TEXT NOT NULL REFERENCES users (github_id),
    verified        BOOLEAN NOT NULL DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publishers_owner ON publishers (owner_github_id);
