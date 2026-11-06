# Saturn Patcher

Applies **Sega Saturn Patcher** (`.ssp`) patches to Sega Saturn disc images.
`.ssp` archives are how the Saturn translation and hacking scene ships fan
translations, region fixes and hacks, so this extension is the apply step for
that ecosystem inside OpenROM.

- Publisher: **M5 Dev** (`m5dev`)
- Category: Sega
- Version: 0.1.0
- Upstream: <https://github.com/ralfguth/saturn-patcher-egui>

## Supported platforms

| Platform | Architecture | Binary |
| --- | --- | --- |
| Windows | x86_64 | `bin/windows/x86_64/saturn-patcher.exe` |
| Linux | x86_64 | `bin/linux/x86_64/saturn-patcher` |

These are the only two builds upstream publishes for v0.1.0. macOS and Linux
arm64 are **not** shipped: the upstream release workflow builds just
`linux-x86_64` and `windows-x86_64`, and a clean-room re-implementation has to
be compiled per target, so there is nothing to package for the other
architectures yet. The manifest declares only what actually exists rather than
pointing at binaries that would 404 or fail their checksum.

## Usage

The tool is applied **in place** and takes exactly two positional arguments:

```bash
saturn-patcher <patch.ssp> <track1.bin>
```

It rewrites Track 1 of a raw **2352-byte/sector** `.bin` rip. It does not create
a new file, so copy your dump first — the tool does not back up.

In OpenROM this is the SSP apply path: OpenROM resolves the `saturn-patcher`
binary for your platform and runs it with the patch and the track-1 BIN.

### Supported routes

- `CUE -> CUE`
- `BIN -> BIN`
- `ISO -> ISO`

## How it works

A clean-room re-implementation of the `.ssp` apply path — no .NET, no Wine:

1. ZIP extraction of the `.ssp` archive.
2. ISO9660 directory walk over raw 2352-byte sectors.
3. `bsdiff` patching of each file.
4. Mode-1 EDC + ECC P/Q regeneration so the result stays a valid disc.

### Limitations

- Only handles `.ssp` patches that keep every patched file the same size
  (in-place rewrite). Patches that *grow* a file would need a full ISO rebuild,
  which is not implemented.
- Operates on **Track 1** of a BIN/CUE rip only.

## Licensing and credit

This extension repackages the upstream **v0.1.0** release binaries unmodified.
The bundled `LICENSE` is the upstream **GNU General Public License v2.0**
(`GPL-2.0-only`), which is the license upstream declares in `Cargo.toml`.

Credit to **Ralf Guth** (<https://github.com/ralfguth>) for
`saturn-patcher-egui`, and to the wider **Sega Saturn preservation and
translation community** — the SegaXtreme forums and the teams whose `.ssp`
patches this tool applies. The EDC/ECC primitives upstream ports come from
Neill Corlett's ECM work, via `ecmlib`.
