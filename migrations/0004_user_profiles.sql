-- Migration 0004 — user profile customization.
--
-- A user's `name` and `avatar_url` are refreshed from GitHub on every login (see
-- `upsertUser`), so a custom display name or uploaded avatar would be overwritten
-- the next time the user signs in. `profile_customized` is the flag that tells the
-- login upsert to leave the user's own values alone.
--
-- It defaults to 0, so existing rows keep syncing from GitHub until the user saves
-- a custom profile.

ALTER TABLE users ADD COLUMN profile_customized INTEGER NOT NULL DEFAULT 0;
