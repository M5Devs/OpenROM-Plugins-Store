#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

REQUIRED_FIELDS = ["id", "name", "version", "author", "conversions"]

def validate_url(url_str: str, field_name: str, file_path: Path) -> bool:
    if not isinstance(url_str, str) or not url_str.strip():
        print(f"❌ Error in {file_path}: '{field_name}' must be a non-empty string.")
        return False
    parsed = urlparse(url_str)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        print(f"❌ Error in {file_path}: '{field_name}' URL '{url_str}' is invalid.")
        return False
    return True

def validate_manifest(file_path: Path) -> bool:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return False

    is_valid = True

    for field in REQUIRED_FIELDS:
        if field not in data or data[field] is None:
            print(f"❌ Error in {file_path}: Missing mandatory field '{field}'.")
            is_valid = False

    if "id" in data and isinstance(data["id"], str):
        plugin_id = data["id"]
        if not plugin_id.strip():
            print(f"❌ Error in {file_path}: Field 'id' must not be empty.")
            is_valid = False

    if "author" in data and isinstance(data["author"], str):
        author_id = data["author"]
        publisher_path = Path("publishers") / f"{author_id}.json"
        if not publisher_path.exists():
            print(f"❌ Error in {file_path}: Author/Publisher '{author_id}' record not found at {publisher_path}.")
            is_valid = False

    if "conversions" in data:
        if not isinstance(data["conversions"], list) or len(data["conversions"]) == 0:
            print(f"❌ Error in {file_path}: Field 'conversions' must be a non-empty list.")
            is_valid = False

    if "download_url" in data and data["download_url"]:
        if not validate_url(data["download_url"], "download_url", file_path):
            is_valid = False

    if "icon" in data and data["icon"]:
        if not validate_url(data["icon"], "icon", file_path):
            is_valid = False

    if "homepage" in data and data["homepage"]:
        if not validate_url(data["homepage"], "homepage", file_path):
            is_valid = False

    return is_valid

def main():
    manifests_dir = Path("manifests")
    if not manifests_dir.exists():
        print("❌ 'manifests/' directory not found.")
        sys.exit(1)

    manifest_files = list(manifests_dir.rglob("manifest.json"))
    if not manifest_files:
        print("⚠️ No manifest.json files found.")
        sys.exit(0)

    print(f"🔍 Validating {len(manifest_files)} plugin manifest(s)...")
    failed_count = 0

    for manifest_path in manifest_files:
        if validate_manifest(manifest_path):
            print(f"✅ Valid: {manifest_path}")
        else:
            failed_count += 1

    if failed_count > 0:
        print(f"❌ Manifest validation failed with {failed_count} error(s).")
        sys.exit(1)
    else:
        print("🎉 All plugin manifests validated successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()
