# Contributing an Extension to the OpenROM Marketplace

This repository holds the **storefront** behind the OpenROM Marketplace
(`openrom-store.pages.dev`). Extension metadata lives in a Cloudflare D1 database,
not in this repository, and there is no static publisher or manifest directory.

**Binary `.orplug` bundles are never committed here.** They are uploaded to
SourceForge FRS and referenced from D1 by download URL and SHA-256 checksum.
`*.orplug` is git-ignored.

Publishing an extension takes five steps.

---

## 1. Publish your `.orplug` bundle to SourceForge

1. Build your extension and package it as `<plugin-id>-<version>.orplug`.
2. Upload it to the OpenROM SourceForge FRS project:

   ```bash
   rsync -av -e ssh "./<plugin-id>-<version>.orplug" \
     "$SF_USER@frs.sourceforge.net:/home/frs/project/openrom-plugins/"
   ```

3. The file is then served from the public download endpoint:

   ```
   https://downloads.sourceforge.net/project/openrom-plugins/<plugin-id>-<version>.orplug
   ```

   Use the `downloads.sourceforge.net` form so mirrors and redirects work.

> SourceForge's FRS rejects hidden files (dotfiles), so keep a normal filename.
> Confirm storage is reachable and writable with
> `bash scripts/test_sourceforge_storage.sh`.

## 2. Compute the SHA-256 checksum

Every extension is verified against the checksum recorded in D1 before it is
listed. Generate it from the exact file you uploaded:

```bash
sha256sum <plugin-id>-<version>.orplug                      # Linux
shasum -a 256 <plugin-id>-<version>.orplug                  # macOS
certutil -hashfile <plugin-id>-<version>.orplug SHA256      # Windows
```

Keep the 64-character lowercase hex digest — it is recorded in D1 in step 5.

## 3. Register as a publisher

Sign in with GitHub and create your publisher profile from `/dashboard`. Publishers
live in the D1 `publishers` table, so there is no publisher file to commit.

Use a short, lowercase, hyphenated id — the same id you will use as your
`publisher_id` below. If it matches your GitHub username (case-insensitive) it is
verified automatically; otherwise a maintainer reviews it.

> **Verification is granted by maintainers, never self-declared.** Verification is
> the `verified` column in D1, which only maintainers can set. Any `is_verified` /
> `verified` value you supply is ignored.

## 4. Prepare your extension metadata

There is no manifest file to commit. An extension row in D1 carries the same
fields, so prepare them as a JSON object to hand to a maintainer:

```json
{
  "id": "your-plugin-id",
  "name": "Your Plugin Name",
  "version": "1.0.0",
  "author": "Your Display Name",
  "publisher_id": "your-publisher-id",
  "min_core_version": "3.9.0",
  "license": "MIT",
  "description": "One or two sentences shown on the storefront card.",
  "homepage": "https://github.com/your-org/your-plugin",
  "icon": "gamepad",
  "download_url": "https://downloads.sourceforge.net/project/openrom-plugins/<plugin-id>-<version>.orplug",
  "sha256": "<64-char lowercase hex digest from step 2>",
  "tags": ["nintendo", "wua"],
  "extensions": [".iso", ".wud", ".wua"],
  "binaries": {
    "win32": "your-tool.exe",
    "linux": "your-tool",
    "darwin": "your-tool"
  },
  "conversions": [
    { "from": "ISO", "to": "WUA", "command": "{bin} convert --in {input} --out {output}" }
  ]
}
```

### Field reference

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Lowercase, hyphenated, unique across the store |
| `name` | yes | Display name on the storefront |
| `version` | yes | Semantic version, e.g. `1.0.0` |
| `author` | yes | Human-readable author name |
| `publisher_id` | yes | Must match a publisher in D1 (created in step 3) |
| `description` | yes | Short summary shown on the card |
| `download_url` | yes | Absolute `https://` URL to your SourceForge `.orplug` |
| `sha256` | yes | Lowercase hex digest of the uploaded bundle |
| `conversions` | yes | Non-empty list of `from` / `to` route mappings |
| `min_core_version` | no | Lowest compatible OpenROM Core version |
| `license` | no | SPDX identifier (e.g. `MIT`, `GPL-3.0`) |
| `homepage` | no | Project or source URL |
| `icon` | no | A [Lucide](https://lucide.dev) icon name, or an absolute image URL |
| `tags` | no | Search keywords |
| `extensions` | no | File extensions your tool accepts |
| `binaries` | no | Per-platform executable names inside the bundle |

## 5. Get the extension recorded in D1

Send the metadata above to a maintainer, who inserts the `plugins` row with the
real download URL and SHA-256. The extension then appears in the marketplace
automatically — no redeploy.

If you are contributing code to the storefront itself (rather than an extension),
fork this repository, make your change on a branch, and open a pull request against
`main`. CI runs `npm run build` on every pull request; on merge to `main`,
Cloudflare Pages rebuilds and redeploys the storefront.

## What reviewers check

- The `download_url` resolves to the uploaded bundle on SourceForge.
- The `sha256` matches that exact bundle.
- `publisher_id` matches a publisher in D1.
- `conversions` are accurate and the description is clear.
- No binaries, no secrets, no self-declared verification.

Once recorded, your extension can be installed with:

```bash
openrom-core --install-plugin <plugin-id>
```

## How your extension reaches the storefront

The storefront reads its catalog live from a Cloudflare D1 database. Once your
`.orplug` bundle is on SourceForge **and** a maintainer has added the matching
`plugins` row, the extension appears automatically — no redeploy, no fabricated
stats. Download counts start at `0` and are incremented by the
`/api/download/<plugin-id>` endpoint.

## Questions

Open a [Discord](https://discord.gg/FYEjpcFYXc) thread and a maintainer will help
you get it over the line.
