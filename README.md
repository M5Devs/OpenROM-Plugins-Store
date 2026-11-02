# OpenROM Marketplace

The metadata-only extension storefront for the **OpenROM** retro-gaming preservation
toolchain. This repository hosts the catalog, extension manifests, and the static
web storefront deployed to Cloudflare Pages at **openrom-store.pages.dev**.

> **This repository never stores plugin binaries.** Packaged `.orplug` bundles live
> exclusively on SourceForge and are referenced from the catalog by URL + SHA-256.
> `*.orplug` is git-ignored and has been purged from the entire Git history.

## Layout

| Path | Purpose |
| --- | --- |
| `public/` | Static storefront (Cloudflare Pages build output) |
| `public/index.html` | Single-page marketplace app (Tailwind + Alpine.js) |
| `public/plugins.json` | Showcase catalog consumed by the storefront |
| `public/api/catalog.json` | Generated catalog API (built by CI) |
| `manifests/m/<publisher>/<plugin>/<version>/manifest.json` | Per-extension manifests |
| `publishers/` | Publisher records |
| `scripts/` | Validation, catalog build, and packaging tooling |
| `schema.sql` | Cloudflare D1 schema (optional dynamic backend) |

## Extension data contract (`public/plugins.json`)

The storefront reads a flat JSON array of extension objects:

```json
[
  {
    "id": "nkit",
    "name": "NKit",
    "version": "3.1.0",
    "minCoreVersion": "3.9.0",
    "publisher": { "id": "nanook", "name": "Nanook", "verified": true },
    "category": "Nintendo",
    "description": "Lossless GameCube & Wii preservation, WUA conversion, and Redump restoration.",
    "readme": "### Features\n- 1:1 Redump disc verification\n- WUA compression\n- Lossless GameCube scrubbing",
    "routes": ["ISO -> WUA", "WUD -> Loadiine", "GCZ -> ISO"],
    "platforms": ["Windows", "Linux", "macOS"],
    "downloadUrl": "https://downloads.sourceforge.net/project/openrom-binaries/plugins/nkit-3.1.0.orplug",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "icon": "gamepad",
    "downloads": 1420,
    "lastUpdated": "2026-10-25",
    "license": "MIT",
    "tags": ["nintendo", "gamecube", "wii", "wua"],
    "rating": 4.9
  }
]
```

`icon` is a [Lucide](https://lucide.dev) icon name; `routes` are human-readable
`INPUT -> OUTPUT` mappings rendered as visual badges in the details drawer.

## Storefront features

- **Header** with OpenROM Marketplace branding, live search, GitHub / Discord links,
  and a **Publish an Extension** call to action.
- **Discovery**: category sidebar (All, Nintendo, PlayStation, Sega, Xbox, Utility,
  Patchers), platform chips (Windows / Linux / macOS), publisher filter, and instant
  client-side search across name, description, publisher, category, tags and routes.
- **Extension cards** with icon, name, verified-publisher badge, download count,
  rating, category, route preview, and a 1-click *Copy CLI install* button.
- **VS Code-style details drawer** with a tabbed interface:
  *Overview* (rendered Markdown), *Supported Routes* (`ISO ➔ WUA` badges),
  *Installation* (CLI + manual GUI drag-and-drop), and *Manifest* (raw JSON viewer).
- **Dark theme** by default (zinc-900/950 with neon cyan/purple accents).

## Local preview

```bash
python3 -m http.server 12000 --directory public
# open http://localhost:12000
```

## Deploy to Cloudflare Pages

The app is 100% static. Point a Pages project at this repository with:

- **Build output directory:** `public`
- **Build command:** *(none)*

Or deploy directly:

```bash
npx wrangler pages deploy public --project-name openrom-store
```

Security headers and legacy redirects are declared in `public/_headers` and
`public/_redirects`.

## Publishing an extension

1. Add `manifests/m/<publisher-id>/<plugin-id>/<version>/manifest.json`.
2. Ensure a matching record exists at `publishers/<publisher-id>.json`.
3. Open a pull request. CI runs `scripts/validate_plugin.py` and
   `scripts/build_catalog.py`, then commits the regenerated `public/api/catalog.json`.

Manifests may not self-declare verification, and the manifest's `publisher_id`
must match its directory path — see `tests/test_security.py`.

## Tooling

```bash
python scripts/validate_plugin.py   # validate manifests
python scripts/build_catalog.py     # regenerate public/api/catalog.json
python -m unittest discover tests   # run the security test suite
```
