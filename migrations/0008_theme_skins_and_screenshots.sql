-- Migration 0008 — screenshot previews for theme (.orskin) listings.
--
-- A theme is a `plugins` row with `category = 'Themes'` (see migration 0006). This
-- adds the one column the marketplace was missing to present a theme the way a
-- skin storefront should: a gallery of images showing the OpenROM desktop app
-- wearing the skin.
--
-- `screenshots_json` is a JSON array of image URLs, defaulting to `'[]'` so every
-- existing row keeps working and a theme with no artwork simply renders no gallery.
-- Like every other `*_json` column it is untrusted input and is validated in
-- src/lib/theme.ts before it reaches an `<img src>`.
--
-- Numbered 0008 rather than 0007 because 0007 is taken by the Saturn Patcher
-- extension migration.

ALTER TABLE plugins ADD COLUMN screenshots_json TEXT DEFAULT '[]';

-- Give the first official theme its screenshot and align its catalogue copy with
-- the marketplace listing. `routes_json` already holds the palette from 0006
-- (#0d0e15 background, #161926 surface, #e94560 accent, #00f0ff highlight,
-- #ffffff text), so it is left untouched here.
UPDATE plugins
   SET screenshots_json = '["/images/romeo-banner.png"]',
       description      = 'Vibrant glowing neon cyan and hot pink retro theme for OpenROM desktop app.'
 WHERE id = 'cyberpunk-neon';
