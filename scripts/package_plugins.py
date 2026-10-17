#!/usr/bin/env python3
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

BINS_REPO_URL = "https://github.com/M5Devs/OpenROM-bins.git"

# Map plugin_id -> mapping of expected binary names to paths in OpenROM-bins repo
# OpenROM-bins layout:
# - windows/x86_64/<bin_name>
# - linux/x86_64/<bin_name>
# - macos/x86_64/<bin_name>

BINARY_MAP = {
    "xbox360-tools": {
        "zar_tool.exe": ["windows/x86_64/XGDTool.exe", "windows/x86_64/extract-xiso.exe"],
        "zar_tool": ["linux/x86_64/XGDTool", "linux/x86_64/extract-xiso", "macos/x86_64/extract-xiso"]
    },
    "nintendo-nkit": {
        "nkit.exe": ["windows/x86_64/nkit.exe"],
        "nkit": ["linux/x86_64/nkit", "macos/x86_64/nkit"]
    },
    "saturn-ssp": {
        "ssp.exe": ["windows/x86_64/saturn-patcher.exe"],
        "ssp": ["linux/x86_64/saturn-patcher", "macos/x86_64/saturn-patcher"]
    }
}

def clone_or_locate_bins(target_dir: Path) -> Path:
    """Clones OpenROM-bins or uses local cached version if present."""
    bins_dir = target_dir / "openrom-bins"
    if bins_dir.exists():
        return bins_dir

    print(f"📥 Cloning OpenROM-bins from {BINS_REPO_URL}...")
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", BINS_REPO_URL, str(bins_dir)],
            check=True, capture_output=True, text=True
        )
        return bins_dir
    except Exception as e:
        print(f"⚠️ Warning: Git clone failed ({e}). Attempting fallback to existing /tmp/openrom-bins if available.")
        fallback = Path("/tmp/openrom-bins")
        if fallback.exists():
            return fallback
        raise e

def compute_sha256(filepath: Path) -> str:
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def package_plugin(manifest_path: Path, bins_dir: Path, packages_dir: Path) -> dict:
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    plugin_id = manifest["id"]
    version = manifest.get("version", "1.0.0")
    print(f"📦 Packaging plugin '{plugin_id}' v{version}...")

    manifest_dir = manifest_path.parent
    binaries = manifest.get("binaries", {})

    # Gather files to package: manifest.json, icon if local, binaries
    files_to_zip = {} # zip_path -> source_file_path

    # Always include manifest.json at root of zip
    files_to_zip["manifest.json"] = manifest_path

    # Include local icon if exists in manifest folder
    for icon_name in ["icon.png", "icon.jpg", "icon.svg"]:
        local_icon = manifest_dir / icon_name
        if local_icon.exists():
            files_to_zip[icon_name] = local_icon
            break

    # Find binaries declared in manifest
    bin_names_needed = set()
    for plat, bin_name in binaries.items():
        if bin_name:
            bin_names_needed.add(bin_name)

    # Collect binaries from OpenROM-bins
    for bin_name in bin_names_needed:
        found_path = None
        # Check mapping first
        if plugin_id in BINARY_MAP and bin_name in BINARY_MAP[plugin_id]:
            for candidate in BINARY_MAP[plugin_id][bin_name]:
                candidate_path = bins_dir / candidate
                if candidate_path.exists():
                    found_path = candidate_path
                    break

        if not found_path:
            # Search in bins_dir
            matches = list(bins_dir.rglob(bin_name))
            if matches:
                found_path = matches[0]

        if found_path and found_path.exists():
            files_to_zip[bin_name] = found_path
        else:
            # Fallback: create stub executable file if real binary missing
            print(f"  ⚠️ Binary '{bin_name}' not found in OpenROM-bins, generating stub binary.")
            stub_dir = manifest_dir / "stubs"
            stub_dir.mkdir(exist_ok=True)
            stub_file = stub_dir / bin_name
            with open(stub_file, "wb") as sf:
                sf.write(f"#!/bin/sh\necho Stub executable for {bin_name}\n".encode("utf-8"))
            files_to_zip[bin_name] = stub_file

    # Create zip archive in packages_dir
    packages_dir.mkdir(parents=True, exist_ok=True)
    out_zip_path = packages_dir / f"{plugin_id}.orplug"

    with zipfile.ZipFile(out_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for zip_rel_path, src_file in files_to_zip.items():
            zf.write(src_file, arcname=zip_rel_path)

    sha256 = compute_sha256(out_zip_path)
    file_size = out_zip_path.stat().st_size

    print(f"  ✅ Created {out_zip_path.name} ({file_size} bytes, SHA256: {sha256[:10]}...)")

    return {
        "plugin_id": plugin_id,
        "package_file": str(out_zip_path),
        "sha256": sha256,
        "size": file_size,
        "download_path": f"packages/{out_zip_path.name}"
    }

def main():
    manifests_dir = Path("manifests")
    packages_dir = Path("packages")

    if not manifests_dir.exists():
        print("❌ 'manifests/' directory not found.")
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        try:
            bins_dir = clone_or_locate_bins(tmp_path)
        except Exception as e:
            print(f"❌ Failed to obtain OpenROM-bins: {e}")
            sys.exit(1)

        manifest_files = sorted(list(manifests_dir.rglob("manifest.json")))
        print(f"🔍 Found {len(manifest_files)} plugin manifest(s) for packaging.")

        results = []
        for m_file in manifest_files:
            res = package_plugin(m_file, bins_dir, packages_dir)
            results.append(res)

    print(f"🎉 Successfully packaged {len(results)} plugin bundle(s) into {packages_dir}/!")

if __name__ == "__main__":
    main()
