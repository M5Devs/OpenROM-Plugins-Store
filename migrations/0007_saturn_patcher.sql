-- Migration 0007 — register the Saturn Patcher extension: saturn-patcher 0.1.0.
--
-- Numbered 0007 rather than 0006 because the Themes work (PR #18) already claims
-- 0006_cyberpunk_neon_theme.sql. Two migrations sharing the 0006 prefix would be
-- ambiguous once both land, so this one takes the next free number.
--
-- This is a data migration, not a schema change. It ships the Saturn Patcher
-- registration with the code that reads it so a deploy cannot land the storefront
-- without the row it is meant to render.
--
-- The bundle it points at is already published to SourceForge:
--   https://downloads.sourceforge.net/project/openrom-plugins/m5dev/saturn-patcher/0.1.0/saturn-patcher-0.1.0.orplug
-- and the `sha256` below is the digest of that exact archive. It is reproducible:
-- `scripts/package_orplug.py` writes a deterministic ZIP, so rebuilding from the
-- same staged binaries yields the same hash. The staged inputs are the upstream
-- v0.1.0 release assets for linux-x86_64 and windows-x86_64, unmodified.
--
-- Only Windows x64 and Linux x64 are declared. Those are the only two builds
-- upstream publishes for v0.1.0 (its release workflow builds just `linux-x86_64`
-- and `windows-x86_64`); macOS and Linux arm64 have no upstream binary to
-- package, so listing them would advertise downloads that do not exist.
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
    'saturn-patcher',
    'Saturn Patcher',
    '0.1.0',
    '3.9.0',
    'm5dev',
    'M5 Dev',
    1,
    'Sega',
    'Sega Saturn disc image patcher supporting official .ssp patch archives for fan translations and hacks.',
    '### Saturn Patcher

Applies **Sega Saturn Patcher** (`.ssp`) patches to Sega Saturn disc images.
`.ssp` archives are how the Saturn translation and hacking scene ships fan
translations, region fixes and hacks, so this extension is the apply step for
that ecosystem.

A clean-room re-implementation of the `.ssp` apply path — no .NET, no Wine:

1. ZIP extraction of the `.ssp` archive
2. ISO9660 walk over raw 2352-byte sectors
3. `bsdiff` patching of each file
4. Mode-1 EDC + ECC P/Q regeneration so the result stays a valid disc

#### Usage

The tool is applied **in place** and takes exactly two positional arguments:

```bash
saturn-patcher <patch.ssp> <track1.bin>
```

It rewrites Track 1 of a raw **2352-byte/sector** `.bin` rip and does **not**
create a new file, so copy your dump first — the tool does not back up.

#### Supported platforms

| Platform | Architecture |
| --- | --- |
| Windows | x86_64 |
| Linux | x86_64 |

macOS and Linux arm64 are not shipped: upstream publishes no binaries for them.

#### Limitations

- Only handles `.ssp` patches that keep every patched file the same size
  (in-place rewrite). Patches that grow a file need a full ISO rebuild, which is
  not implemented.
- Operates on Track 1 of a BIN/CUE rip only.

Created by **Ralf Guth** and maintained upstream at
<https://github.com/ralfguth/saturn-patcher-egui>. This is an OpenROM community
repackage; the bundled executables are the upstream v0.1.0 release binaries,
unmodified. Credit also to the Sega Saturn preservation and translation
community. Licensed under the GNU General Public License v2.0 (GPL-2.0-only).',
    '["CUE -> CUE","BIN -> BIN","ISO -> ISO"]',
    '["Windows","Linux"]',
    'https://downloads.sourceforge.net/project/openrom-plugins/m5dev/saturn-patcher/0.1.0/saturn-patcher-0.1.0.orplug',
    '64f10916b306c7da70a6ed00fbf6cb367e05dd50ac5ba08116eda2743aa2c779',
    'disc',
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
