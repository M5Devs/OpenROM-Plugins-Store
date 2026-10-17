#!/usr/bin/env python3
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

def load_verified_publishers() -> set:
    v_file = Path("verified_publishers.json")
    if v_file.exists():
        try:
            with open(v_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return set(data)
        except Exception as e:
            print(f"⚠️ Warning: Failed to load verified publishers from {v_file}: {e}")
    return set()

def load_publishers(verified_ids: set) -> dict:
    publishers = {}
    pub_dir = Path("publishers")
    if pub_dir.exists():
        for p_file in pub_dir.glob("*.json"):
            try:
                with open(p_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "id" in data:
                        pub_id = data["id"]
                        data["is_verified"] = pub_id in verified_ids
                        data.pop("verified", None)
                        publishers[pub_id] = data
            except Exception as e:
                print(f"⚠️ Warning: Failed to load publisher {p_file}: {e}")
    return publishers

def build_catalog():
    manifests_dir = Path("manifests")
    if not manifests_dir.exists():
        print("❌ 'manifests/' directory not found.")
        sys.exit(1)

    verified_ids = load_verified_publishers()
    publishers = load_publishers(verified_ids)
    plugins = []

    manifest_files = sorted(list(manifests_dir.rglob("manifest.json")))
    print(f"📦 Found {len(manifest_files)} manifest(s) for catalog generation.")

    for m_file in manifest_files:
        try:
            with open(m_file, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            # Ignore any is_verified or verified flags originating from individual manifest files
            clean_manifest = {
                k: v for k, v in manifest.items()
                if k not in ("is_verified", "verified")
            }

            author_id = clean_manifest.get("author") or clean_manifest.get("publisher_id", "")

            publisher_data = publishers.get(author_id, {
                "id": author_id,
                "name": author_id,
                "github": "",
                "is_verified": author_id in verified_ids,
                "badge": None
            })

            # Ensure publisher_data is_verified strictly matches the authoritative list
            publisher_data = dict(publisher_data)
            publisher_data["is_verified"] = author_id in verified_ids
            publisher_data.pop("verified", None)

            plugin_entry = {
                **clean_manifest,
                "publisher": publisher_data
            }
            plugins.append(plugin_entry)
        except Exception as e:
            print(f"❌ Error processing {m_file}: {e}")
            sys.exit(1)

    catalog_data = {
        "version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_plugins": len(plugins),
        "plugins": plugins
    }

    output_dir = Path("public/api")
    output_dir.mkdir(parents=True, exist_ok=True)
    catalog_file = output_dir / "catalog.json"

    with open(catalog_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"✨ Successfully generated catalog at {catalog_file} with {len(plugins)} plugin(s).")

if __name__ == "__main__":
    build_catalog()
