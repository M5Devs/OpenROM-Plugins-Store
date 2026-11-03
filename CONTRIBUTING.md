# Contributing an Extension to the OpenROM Marketplace

This repository is the **metadata-only** catalog behind the OpenROM Marketplace
(`openrom-store.pages.dev`). It holds publisher records, extension manifests, and
the static storefront.

**Binary `.orplug` bundles are never committed here.** They are hosted on
SourceForge and referenced from your manifest by download URL and SHA-256
checksum. `*.orplug` is git-ignored.

Submitting an extension takes five steps.

---

## 1. Publish your `.orplug` bundle to SourceForge

1. Build your extension and package it as `<plugin-id>-<version>.orplug`.
2. Upload it to your SourceForge project's release files.
3. Copy the **direct download URL** for the uploaded file, for example:

   ```
   https://downloads.sourceforge.net/project/<project>/plugins/<plugin-id>-<version>.orplug
   ```

   Use the `downloads.sourceforge.net` form so mirrors and redirects work.

## 2. Compute the SHA-256 checksum

Every extension is verified against the checksum in its manifest before it is
listed. Generate it from the exact file you uploaded:

```bash
sha256sum <plugin-id>-<version>.orplug                      # Linux
shasum -a 256 <plugin-id>-<version>.orplug                  # macOS
certutil -hashfile <plugin-id>-<version>.orplug SHA256      # Windows
```

Paste the 64-character lowercase hex digest into the manifest's `sha256` field.

## 3. Register as a publisher

Sign in with GitHub and create your publisher profile from `/dashboard`. Publishers
live in the D1 `publishers` table, so there is no publisher file to commit.

Use a short, lowercase, hyphenated id — the same id you will use in your manifest.
If it matches your GitHub username (case-insensitive) it is verified automatically;
otherwise a maintainer reviews it.

> **Verification is granted by maintainers, never self-declared.** Verification is
> the `verified` column in D1, which only maintainers can set. Any `is_verified` /
> `verified` value in your manifest is ignored, and claiming verification in a
> manifest fails validation.

## 4. Add your extension manifest

Manifests live at `manifests/m/<publisher-id>/<plugin-id>/<version>/manifest.json`
— note the `m/` shard directory. The `<publisher-id>` path segment **must** match
the manifest's `publisher_id`, or validation fails.

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
  "download_url": "https://downloads.sourceforge.net/project/<project>/plugins/<plugin-id>-<version>.orplug",
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
| `publisher_id` | yes | Must match the manifest's directory path **and** a publisher in D1 |
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

## 5. Open a pull request

1. Fork this repository and create a branch, e.g. `add/your-plugin-id`.
2. Add your publisher file and manifest. **Do not** add any `.orplug` file —
   the pull request will be rejected if binaries are included.
3. Run the checks locally:

   ```bash
   python scripts/validate_plugin.py     # validates every manifest
   python -m unittest discover tests     # security tests
   ```

4. Commit, push, and open a pull request against `main`.

CI runs `scripts/validate_plugin.py`, the security test suite, and `npm run build`
on every pull request. On merge to `main` Cloudflare Pages rebuilds and redeploys
the storefront.

## What reviewers check

- The `download_url` resolves to the uploaded bundle on SourceForge.
- The `sha256` matches that exact bundle.
- `publisher_id` matches both the publisher record and the manifest directory.
- `conversions` are accurate and the description is clear.
- No binaries, no secrets, no self-declared verification.

Once merged, your extension appears in the marketplace automatically and can be
installed with:

```bash
openrom-core --install-plugin <plugin-id>
```

## How your extension reaches the storefront

The storefront reads its catalog live from a Cloudflare D1 database. Once your
manifest is merged **and** your `.orplug` bundle is uploaded to SourceForge (or a
GitHub release), a maintainer adds a row to the `plugins` table with the real
download URL and SHA-256. The extension then appears automatically — no redeploy,
no fabricated stats. Download counts start at `0` and are incremented by the
`/api/download/<plugin-id>` endpoint.

## Questions

Open a [Discord](https://discord.gg/FYEjpcFYXc) thread or a draft pull request and a
maintainer will help you get it over the line.
