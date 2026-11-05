-- Migration 0006 — register the first official theme: Cyberpunk Neon 1.0.0.
--
-- A theme is an ordinary `plugins` row with `category = 'Themes'`; there is no
-- separate table. The columns that normally describe conversion tooling carry the
-- theme's payload instead:
--
--   routes_json    -> the colour palette, an array of hex strings. The storefront
--                     reads it positionally (Background, Surface, Accent, Text)
--                     and validates every value before it reaches a `style`.
--   platforms_json -> ["All Platforms"], because a theme is not OS-specific.
--
-- The file it points at ships with this repository at public/themes/cyberpunk-neon.orskin,
-- and the `sha256` below is the digest of that exact file. The download URL is
-- root-relative on purpose: the file is served by this same site, so a relative
-- Location works on the production domain, on every Cloudflare Pages preview
-- deployment, and in local `wrangler pages dev` without hardcoding a hostname.
--
-- Re-running is safe and never resets a live download counter: the upsert updates
-- every column *except* `downloads`.
--
-- `publisher_id` is what the storefront joins on (see PLUGIN_SOURCE in
-- src/lib/db.ts). The M5 Dev publisher row is created by migration 0005, so
-- INSERT OR IGNORE here is a no-op when that has already run.

INSERT OR IGNORE INTO publishers (id, name, owner_github_id, verified) VALUES
  ('m5dev', 'M5 Dev', '193546948', 1);

INSERT INTO plugins
  (id, name, version, min_core_version, publisher_id, publisher_name, publisher_verified,
   category, description, readme_markdown, routes_json, platforms_json,
   download_url, sha256, icon, downloads)
VALUES
  (
    'cyberpunk-neon',
    'Cyberpunk Neon',
    '1.0.0',
    '3.9.0',
    'm5dev',
    'M5 Dev',
    1,
    'Themes',
    'Official high-contrast glowing neon cyan and hot pink retro-futuristic theme for OpenROM.',
    '### Cyberpunk Neon

A high-contrast, glow-forward skin for OpenROM. Deep near-black panels, a lifted
slate surface, and hot pink / cyan accents that carry the retro-futuristic look
without washing out long sessions.

- **Background** — near-black for low glare on OLED and CRT-adjacent setups
- **Surface** — lifted slate so panels and cards stay legible
- **Accent** — hot pink primary with a cyan highlight for focus rings and links
- **Text** — pure white on dark for maximum contrast

#### Applying

Apply straight from the store with the **Apply in OpenROM** deep link, or download
the `.orskin` file and import it from *Settings → Appearance → Import…*.',
    '["#0d0e15", "#161926", "#e94560", "#00f0ff", "#ffffff"]',
    '["All Platforms"]',
    '/themes/cyberpunk-neon.orskin',
    'ebe9e4056af600bfb6a2337b3114523d17924acb5196ff60bb1e5d0f0aa1d77a',
    'palette',
    0
  )
ON CONFLICT (id) DO UPDATE SET
  name               = excluded.name,
  version            = excluded.version,
  min_core_version   = excluded.min_core_version,
  publisher_id       = excluded.publisher_id,
  publisher_name     = excluded.publisher_name,
  publisher_verified = excluded.publisher_verified,
  category           = excluded.category,
  description        = excluded.description,
  readme_markdown    = excluded.readme_markdown,
  routes_json        = excluded.routes_json,
  platforms_json     = excluded.platforms_json,
  download_url       = excluded.download_url,
  sha256             = excluded.sha256,
  icon               = excluded.icon;
