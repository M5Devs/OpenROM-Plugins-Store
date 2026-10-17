#!/usr/bin/env python3
from datetime import datetime, timezone
import json

from pathlib import Path
import sys

def load_publishers() -> dict:
    publishers = {}
    pub_dir = Path("publishers")
    if pub_dir.exists():
        for p_file in pub_dir.glob("*.json"):
            try:
                with open(p_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "id" in data:
                        publishers[data["id"]] = data
            except Exception as e:
                print(f"⚠️ Warning: Failed to load publisher {p_file}: {e}")
    return publishers

def build_catalog():
    manifests_dir = Path("manifests")
    if not manifests_dir.exists():
        print("❌ 'manifests/' directory not found.")
        sys.exit(1)

    publishers = load_publishers()
    plugins = []

    manifest_files = sorted(list(manifests_dir.rglob("manifest.json")))
    print(f"📦 Found {len(manifest_files)} manifest(s) for catalog generation.")

    for m_file in manifest_files:
        try:
            with open(m_file, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            author_id = manifest.get("author", "")
            publisher_data = publishers.get(author_id, {
                "id": author_id,
                "name": author_id,
                "github": "",
                "is_verified": False,
                "badge": None
            })

            plugin_entry = {
                **manifest,
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
