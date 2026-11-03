-- Migration 0003 — publisher profile customization and the plugins → publisher link.
--
-- The customization columns below are all additive and default to empty strings,
-- so existing publisher rows keep working untouched.
--
-- `plugins.publisher_id` is the link the public profile page needs: without it a
-- plugin can only be matched to a publisher by display name, which is neither
-- unique nor stable. Backfilling it from the seeded publisher is a one-time fixup;
-- from here on the value is set when a plugin row is inserted.

ALTER TABLE publishers ADD COLUMN bio         TEXT DEFAULT '';
ALTER TABLE publishers ADD COLUMN avatar_url  TEXT DEFAULT '';
ALTER TABLE publishers ADD COLUMN banner_url  TEXT DEFAULT '';
ALTER TABLE publishers ADD COLUMN website_url TEXT DEFAULT '';
ALTER TABLE publishers ADD COLUMN github_url  TEXT DEFAULT '';
ALTER TABLE publishers ADD COLUMN discord_url TEXT DEFAULT '';
ALTER TABLE publishers ADD COLUMN twitter_url TEXT DEFAULT '';

ALTER TABLE plugins ADD COLUMN publisher_id TEXT;

CREATE INDEX IF NOT EXISTS idx_plugins_publisher ON plugins (publisher_id);

-- The only publisher that exists in the seed data is the repository owner.
UPDATE plugins
   SET publisher_id = 'clausvalca'
 WHERE publisher_id IS NULL
   AND publisher_name = 'Claus Valca (M5 Dev)';
