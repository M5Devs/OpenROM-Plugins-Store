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
| `src/pages/dashboard.astro` | Signed-in publisher dashboard (create + list publishers) |
| `src/pages/dashboard/settings.astro` | Account settings (display name + avatar upload) |
| `src/pages/dashboard/publisher/[id].astro` | Owner-only publisher profile editor |
| `src/pages/publisher/[id].astro` | Public publisher showcase page |
| `src/pages/api/plugins.json.ts` | Live catalog: `SELECT * FROM plugins` |
| `src/pages/api/download/[id].ts` | Atomic download counter + redirect to the bundle |
| `src/pages/api/auth/login.ts` | Redirects to GitHub OAuth with a `state` cookie |
| `src/pages/api/auth/callback.ts` | Exchanges the code, upserts the user, issues the session cookie |
| `src/pages/api/auth/logout.ts` | Clears the session cookie |
| `src/pages/api/user/profile.ts` | `PATCH` the signed-in user's display name + avatar |
| `src/pages/api/publishers/create.ts` | Creates a publisher owned by the signed-in user |
| `src/pages/api/publishers/[id].ts` | `GET` a publisher profile + stats; `PATCH` the owner's branding |
| `src/components/` | `Navbar`, `Card`, `DetailDrawer`, `CategoryFilter`, `Icon`, `ImageField` |
| `src/lib/db.ts` | Typed D1 access layer for the catalog |
| `src/lib/session.ts` | HMAC-signed session token (sign/verify) |
| `src/lib/auth.ts` | Session helpers shared by pages and API routes |
| `src/lib/github.ts` | GitHub OAuth + user API client |
| `src/lib/users.ts` / `src/lib/publishers.ts` | D1 access for accounts and publishers |
| `src/lib/publisher-profile.ts` | Assembles a publisher with its stats and extensions; `loadPublisherProfile` separates "not found" from a database error |
| `src/lib/image.ts` | Image size/format validation + dimension parsing (shared) |
| `src/lib/image-client.ts` | Browser-side downscale + WebP encoding for uploads |
| `src/lib/media.ts` | Accepts an uploaded image data URL or an http(s) URL |
| `migrations/0001_init.sql` | D1 schema for the catalog |
| `migrations/0002_auth_and_publishers.sql` | D1 schema for users + publishers |
| `migrations/0003_publisher_profiles.sql` | Publisher profile fields + `plugins.publisher_id` |
| `migrations/0004_user_profiles.sql` | `users.profile_customized` flag |
| `seed/0001_seed.sql` | Seed with the repository's real, verified extensions |
| `manifests/m/<publisher>/<plugin>/<version>/manifest.json` | Per-extension manifests |
| `publishers/` | Publisher records |
| `scripts/` | Manifest validation tooling |
| `tests/auth.test.ts` / `tests/publisher-profile.test.ts` / `tests/publisher-profile-page.test.ts` / `tests/user-profile.test.ts` | Unit tests (`npm test`) |
| `wrangler.toml` | Cloudflare Pages + D1 binding configuration |

## Local development

```bash
npm install

# 1. Create the local D1 database, apply the schema, and load the seed data.
npm run db:reset:local

# 2. Put the GitHub OAuth credentials + a session secret in .dev.vars (git-ignored):
#    GITHUB_CLIENT_ID=...
#    GITHUB_CLIENT_SECRET=...
#    SESSION_SECRET=...   # falls back to GITHUB_CLIENT_SECRET when unset

# 3. Start the dev server (emulates the D1 binding via platformProxy).
npm run dev            # http://localhost:4321
```

Useful scripts:

```bash
npm run build                 # production build to dist/
npm test                      # session + publisher unit tests
npm run db:migrate:local      # apply migrations locally
npm run db:seed:local         # (re)load seed data
python scripts/validate_plugin.py   # validate manifests
python -m unittest discover tests   # security test suite
```

## Authentication

Sign-in uses GitHub OAuth (`scope=read:user`). The callback exchanges the code for
an access token, reads `https://api.github.com/user`, upserts the account into the
`users` table, and issues a **stateless, HMAC-SHA256-signed** session cookie
(`openrom_session`, HttpOnly, `SameSite=Lax`, `Secure` on HTTPS, 30-day lifetime).
The token payload is the public GitHub profile — it carries no secret, so the HMAC
signature is what makes it tamper-proof.

Publisher slugs are validated as lowercase alphanumeric words joined by single
hyphens. A slug that matches the owner's GitHub username (case-insensitively) is
**auto-verified** (`verified = 1`); every other slug is unverified. `verified` is
derived server-side and can never be supplied by the client.

Register the callback URL on the GitHub OAuth app as
`https://openrom-store.pages.dev/api/auth/callback` (and, for local development,
`http://localhost:4321/api/auth/callback`).

## Publisher profiles

Every publisher has a public showcase page at `/publisher/<slug>` and an owner-only
editor at `/dashboard/publisher/<slug>`. The owner can set a display name, a
markdown bio, an avatar and banner image, and website / GitHub / Discord / Twitter
links. All of these are validated server-side in `PATCH /api/publishers/[id]`:

- Only the owner may edit (`owner_github_id` must match the session); `id`,
  `verified`, and `owner_github_id` are never taken from the request body.
- Social and image URLs must be absolute `http(s)` URLs, so `javascript:` and
  `data:` values cannot reach an `href`/`src`.
- The bio is rendered through the same markdown sanitizer as plugin READMEs.

The profile page shows live aggregates (extension count and total downloads) that
are summed in D1 at request time, and the publisher's extensions as the standard
catalog cards. Plugins link to their publisher through `plugins.publisher_id`, and
a plugin's name and verification are read from the `publishers` row via a `LEFT
JOIN`, so renaming a publisher updates every card immediately. Rows that predate
the link column fall back to matching on `publisher_name`.

## Account settings

Signed-in users can set a custom display name and avatar at `/dashboard/settings`
(`PATCH /api/user/profile`). GitHub supplies the initial `name` and `avatar_url`, and
they are refreshed on every login — so saving a custom profile sets a
`profile_customized` flag (migration 0004) that tells the login upsert to leave the
user's own values alone. Clearing the avatar falls back to the GitHub one.

The avatar is stored in D1, not in the session cookie: a session token is a stateless
HMAC-signed cookie capped at roughly 4 KB, and a base64 image is far larger. Pages read
the custom profile from D1 at render time and overlay it on the session (see
`toUserProfile`), so the navbar and dashboard show the uploaded avatar without ever
putting it in the cookie.

## Image uploads

The avatar and cover-banner fields accept a direct file input
(`<input type="file" accept="image/png,image/jpeg,image/webp">`). There is no upload
endpoint — the browser does the work:

1. `src/lib/image-client.ts` decodes the file, downscales it to fit the field's maximum
   dimension, and re-encodes it as WebP (`canvas.toDataURL('image/webp', …)`), shrinking
   the scale further until the result fits the 1.5 MB cap.
2. The resulting `data:` URL is written to a hidden input, shown in the live preview, and
   submitted with the rest of the form.

The server never trusts it: `src/lib/image.ts` re-checks the declared MIME type against
the real magic bytes (a PNG renamed to `.webp` is rejected), the decoded size, and the
dimensions parsed straight from the file header. Avatars cap at 512 px, banners at
1600 px. D1's hard limit is 2 MB per row, so 1.5 MB per image keeps a row holding both
an avatar and a banner within it. A plain absolute `http(s)` URL is still accepted in
place of an upload, and `javascript:`/`data:text/html` values are always rejected.

## Provisioning the D1 database

```bash
# Create the database, then copy the printed database_id into wrangler.toml.
npx wrangler d1 create openrom-store

# Apply migrations + seed to the remote database.
npm run db:migrate:remote
npm run db:seed:remote
```

> **Migrations are not applied by CI.** Nothing in `.github/workflows/` touches
> the remote database, so after adding a migration you must run
> `npm run db:migrate:remote` yourself. A table that a route reads but the remote
> database does not have (for example `publishers` before migration 0002) makes
> that route fail; the pages render a 503 fallback rather than a 500, but the
> feature stays broken until the migration is applied. If a route suddenly
> returns "temporarily unavailable", check `npx wrangler d1 migrations list
> openrom-store --remote` first.

## Deploy to Cloudflare Pages

Create a Pages project for this repository and set:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Build system version:** **V2** (required — configuring D1 bindings through
  `wrangler.toml` needs V2; see the [Pages Wrangler configuration docs](https://developers.cloudflare.com/pages/functions/wrangler-configuration/))
- **Compatibility flags:** `nodejs_compat`
- **D1 binding:** variable `DB` → the `openrom-store` database
- **Environment variables (encrypted):** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
  and (recommended) `SESSION_SECRET` for signing session cookies

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
