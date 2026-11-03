-- Seed — only real, verified extensions already present in this repository.
--
-- Provenance:
--   * The `publishers` row below is the single registered publisher. It is seeded
--     directly (not read from a file) with `verified = 1`; publisher records live in
--     D1, not in this repository.
--   * The three rows mirror manifests/m/clausvalca/**/manifest.json (real metadata).
--   * downloads is 0 and sha256 is '' because no `.orplug` bundle has been published
--     yet (SourceForge `openrom-binaries` currently ships raw binaries only, and the
--     GitHub repository has no releases). Nothing here is fabricated; empty values
--     signal "not yet published" and are surfaced as such in the UI.
--   * The users/publishers rows mirror that same publisher record; the GitHub id and
--     avatar come from the public GitHub API for ClausValcaTD.
--
-- Re-running is safe (INSERT OR REPLACE) and never resets a live download counter.

INSERT OR REPLACE INTO users (github_id, github_username, name, avatar_url) VALUES
  (
    '193546948',
    'ClausValcaTD',
    'Claus Valca',
    'https://avatars.githubusercontent.com/u/193546948?v=4'
  );

INSERT OR REPLACE INTO publishers
  (id, name, owner_github_id, verified, created_at, bio, avatar_url, banner_url,
   website_url, github_url, discord_url, twitter_url)
VALUES
  (
    'clausvalca',
    'Claus Valca (M5 Dev)',
    '193546948',
    1,
    '2026-10-17 00:00:00',
    'Creator & Core Architect of OpenROM and Official Plugin Toolchains',
    'https://avatars.githubusercontent.com/u/193546948?v=4',
    '',
    '',
    'https://github.com/M5Devs',
    'https://discord.gg/FYEjpcFYXc',
    ''
  );

INSERT OR REPLACE INTO plugins
  (id, name, version, min_core_version, publisher_id, publisher_name, publisher_verified,
   category, description, readme_markdown, routes_json, platforms_json,
   download_url, sha256, icon, downloads)
VALUES
  (
    'nintendo-nkit',
    'Nintendo NKit & ZArchive Suite',
    '3.1.0',
    '3.9.0',
    'clausvalca',
    'Claus Valca (M5 Dev)',
    1,
    'Nintendo',
    'Standalone NKit suite for Nintendo GameCube, Wii, and Wii U ZArchive compression.',
    '### Nintendo NKit & ZArchive Suite

Standalone suite for Nintendo GameCube, Wii, and Wii U disc workflows.

- **NKit** lossless GameCube / Wii image processing
- **ZArchive** compression for Wii U titles
- **WUA** conversion pipeline

#### Usage

```bash
nkit convert --in game.iso --out game.wua
```

Verify every conversion against the community DAT before writing your archive.',
    '["WUD -> WUA"]',
    '["Windows","Linux","macOS"]',
    'https://github.com/M5Devs/OpenROM-Plugins-Store/releases/download/v3.1.0/nintendo-nkit.orplug',
    '',
    'gamepad',
    0
  ),
  (
    'saturn-ssp',
    'Sega Saturn Patcher (SSP)',
    '1.0.0',
    '3.9.0',
    'clausvalca',
    'Claus Valca (M5 Dev)',
    1,
    'Sega',
    'Specialized Sega Saturn Patcher disc modification tool.',
    '### Sega Saturn Patcher (SSP)

Disc-level patching for Sega Saturn images.

- Region-free patching
- BIN/CUE aware track handling
- Non-destructive output

#### Usage

```bash
ssp -i disc.bin -o disc.patched.bin
```',
    '["ISO -> SSP"]',
    '["Windows","Linux","macOS"]',
    'https://github.com/M5Devs/OpenROM-Plugins-Store/releases/download/v1.0.0/saturn-ssp.orplug',
    '',
    'disc',
    0
  ),
  (
    'xbox360-tools',
    'Xbox 360 ZAR & XISO Tools',
    '1.0.0',
    '3.9.0',
    'clausvalca',
    'Claus Valca (M5 Dev)',
    1,
    'Xbox',
    'Extract XISO and compress to .zar for Xenia Edge.',
    '### Xbox 360 ZAR & XISO Tools

Xbox 360 image tooling tuned for Xenia Edge.

- Extract XISO into a rebuildable file tree
- Compress to `.zar` for random-access streaming
- Batch mode for whole libraries

#### Usage

```bash
zar_tool compress --input game.xiso --output game.zar
```',
    '["XISO -> ZAR"]',
    '["Windows","Linux","macOS"]',
    'https://github.com/M5Devs/OpenROM-Plugins-Store/releases/download/v1.0.0/xbox360-tools.orplug',
    '',
    'archive',
    0
  );
