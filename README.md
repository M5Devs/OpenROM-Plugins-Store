# OpenROM Marketplace

The extension marketplace for the **OpenROM** retro-gaming preservation toolchain.
It is a full-stack [Astro](https://astro.build) application that renders on demand at
the edge and reads its catalog live from a **Cloudflare D1** database. It deploys to
Cloudflare Pages at **openrom-store.pages.dev**.

> **This repository never stores plugin binaries.** Packaged `.orplug` bundles are
> hosted on SourceForge (or a GitHub release) and referenced from the catalog by
> download URL + SHA-256. `*.orplug` is git-ignored and has been purged from the
> entire Git history.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Astro 5 (`output: 'server'`) |
| Adapter | `@astrojs/cloudflare` (Cloudflare Pages) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Database | Cloudflare D1 (`DB` binding) |
| Markdown | `marked` + a small sanitizer |

## Zero fake data

The store shows **only real numbers**. Download counts are real integers that start at
`0` and are incremented by the download endpoint; there are no fabricated ratings.
If D1 is empty, the storefront renders a professional empty state:

> **No community extensions published yet — Be the first to build for OpenROM!**

with a direct call to action to the [submission guide](./CONTRIBUTING.md).

## Layout

| Path | Purpose |
| --- | --- |
| `src/pages/index.astro` | Storefront (search, filters, cards, detail drawer) |
| `src/pages/api/plugins.json.ts` | Live catalog: `SELECT * FROM plugins` |
| `src/pages/api/download/[id].ts` | Atomic download counter + redirect to the bundle |
| `src/components/` | `Navbar`, `Card`, `DetailDrawer`, `CategoryFilter`, `Icon` |
| `src/lib/db.ts` | Typed D1 access layer |
| `migrations/0001_init.sql` | D1 schema |
| `seed/0001_seed.sql` | Seed with the repository's real, verified extensions |
| `manifests/m/<publisher>/<plugin>/<version>/manifest.json` | Per-extension manifests |
| `publishers/` | Publisher records |
| `scripts/` | Manifest validation tooling |
| `wrangler.toml` | Cloudflare Pages + D1 binding configuration |

## Local development

```bash
npm install

# 1. Create the local D1 database, apply the schema, and load the seed data.
npm run db:reset:local

# 2. Start the dev server (emulates the D1 binding via platformProxy).
npm run dev            # http://localhost:4321
```

Useful scripts:

```bash
npm run build                 # production build to dist/
npm run db:migrate:local      # apply migrations locally
npm run db:seed:local         # (re)load seed data
python scripts/validate_plugin.py   # validate manifests
python -m unittest discover tests   # security test suite
```

## Provisioning the D1 database

```bash
# Create the database, then copy the printed database_id into wrangler.toml.
npx wrangler d1 create openrom-store

# Apply migrations + seed to the remote database.
npm run db:migrate:remote
npm run db:seed:remote
```

## Deploy to Cloudflare Pages

Create a Pages project for this repository and set:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Build system version:** **V2** (required — configuring D1 bindings through
  `wrangler.toml` needs V2; see the [Pages Wrangler configuration docs](https://developers.cloudflare.com/pages/functions/wrangler-configuration/))
- **Compatibility flags:** `nodejs_compat`
- **D1 binding:** variable `DB` → the `openrom-store` database

> Upgrading an existing project that was a no-build static site (as this one was)
> requires setting the build command and switching the project to the V2 build
> system in **Settings → Build**; otherwise the build fails with
> "Output directory not found" and the `wrangler.toml` bindings are ignored.

Once `wrangler.toml` carries a real `database_id`, Cloudflare reads the binding
from it. Alternatively deploy from the CLI:

```bash
npm run build
npx wrangler pages deploy dist --project-name openrom-store
```

## Publishing an extension

1. Add `manifests/m/<publisher-id>/<plugin-id>/<version>/manifest.json`.
2. Ensure a matching record exists at `publishers/<publisher-id>.json`.
3. Open a pull request. CI validates the manifests and builds the site.
4. Once the `.orplug` bundle is published, a maintainer inserts the row (with its
   real SHA-256) into D1 so the extension appears in the marketplace.

Manifests may not self-declare verification, and the manifest's `publisher_id` must
match its directory path — see `tests/test_security.py`.
