-- Migration 0005 — register the first community-packaged plugin: NKit 3.2.0.
--
-- This is a data migration, not a schema change. It ships the NKit registration
-- with the code that reads it so a deploy cannot land the storefront without the
-- row it is meant to render.
--
-- The bundle it points at is already published to SourceForge:
--   https://downloads.sourceforge.net/project/openrom-plugins/m5dev/nkit/3.2.0/nkit-3.2.0.orplug
-- and the `sha256` below is the digest of that exact archive. It is reproducible:
-- `scripts/package_orplug.py` writes a deterministic ZIP, so rebuilding from the
-- same staged binaries yields the same hash.
--
-- `publisher_id` is what the storefront joins on (see `PLUGIN_SOURCE` in
-- src/lib/db.ts); `publisher_name`/`publisher_verified` are the denormalized
-- fallback used only if the publisher row is missing.
--
-- Re-running is safe and never resets a live download counter: the plugin upsert
-- updates every column *except* `downloads`.

-- The M5 Dev publisher identity. It is owned by the existing M5Devs account
-- (ClausValcaTD). `INSERT OR IGNORE` makes both statements no-ops when the user or
-- publisher already exists, so this works whether or not the seed has been applied.
INSERT OR IGNORE INTO users (github_id, github_username, name, avatar_url) VALUES
  (
    '193546948',
    'ClausValcaTD',
    'Claus Valca',
    'https://avatars.githubusercontent.com/u/193546948?v=4'
  );

INSERT OR IGNORE INTO publishers (id, name, owner_github_id, verified) VALUES
  ('m5dev', 'M5 Dev', '193546948', 1);

INSERT INTO plugins
  (id, name, version, min_core_version, publisher_id, publisher_name, publisher_verified,
   category, description, readme_markdown, routes_json, platforms_json,
   download_url, sha256, icon, downloads)
VALUES
  (
    'nkit',
    'NKit',
    '3.2.0',
    '3.9.0',
    'm5dev',
    'M5 Dev',
    1,
    'Nintendo',
    'Nintendo GameCube, Wii, and Wii U disc restoration, WUA, and compression suite.',
    '### NKit

Lossless Nintendo GameCube, Wii, and Wii U disc image toolkit. Converted images
expand back to a bit-for-bit copy of the source disc.

- **Restoration** — rebuild a full, byte-identical disc image from an NKit image
- **NKit conversion** — shrink to `.nkit.iso` losslessly
- **WUA** — Wii U archive output, image and index formats configurable independently
- **ZArchive** — parallel per-block ZStd compression
- **Verification** — check images against checksums, DAT files, and NKit scans

#### Usage

```bash
nkit convert --input game.iso --output game.wua
```

Created by **Nanook** and maintained upstream at
<https://github.com/Nanook/NKit>. This is an OpenROM community repackage; the
bundled executables are the upstream v3.2.0 release binaries, unmodified.
Licensed under the MIT License.',
    '["ISO -> WUA","WUD -> Loadiine","WUX -> WUA","RVZ -> ISO","GCZ -> ISO"]',
    '["Windows","Linux","macOS"]',
    'https://downloads.sourceforge.net/project/openrom-plugins/m5dev/nkit/3.2.0/nkit-3.2.0.orplug',
    'bd62db8e7ab61075e08424f5fe22ed0bdc2d73f9bf3ba5a11cd7ef7af2e8f717',
    'gamepad',
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
