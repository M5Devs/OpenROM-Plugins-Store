import json
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest

class SecurityTests(unittest.TestCase):
    def test_build_catalog_ignores_fraudulent_verification(self):
        """Test that build_catalog.py sets is_verified=False for unlisted publishers even if manifest claims is_verified: true."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)

            # Setup verified_publishers.json in temp directory
            verified_pub = tmppath / "verified_publishers.json"
            verified_pub.write_text(json.dumps(["m5dev"]), encoding="utf-8")

            # Setup publishers directory
            pub_dir = tmppath / "publishers"
            pub_dir.mkdir()
            (pub_dir / "m5dev.json").write_text(json.dumps({
                "id": "m5dev", "name": "M5", "is_verified": True
            }), encoding="utf-8")
            (pub_dir / "attacker.json").write_text(json.dumps({
                "id": "attacker", "name": "Attacker", "is_verified": True
            }), encoding="utf-8")

            # Setup manifests
            manifest_dir = tmppath / "manifests" / "a" / "attacker" / "bad-plugin" / "1.0.0"
            manifest_dir.mkdir(parents=True)
            manifest = {
                "id": "bad-plugin",
                "name": "Bad Plugin",
                "version": "1.0.0",
                "author": "attacker",
                "conversions": ["ISO"],
                "is_verified": True,
                "verified": True
            }
            (manifest_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

            code = f"""
import sys
from pathlib import Path
import os
os.chdir(r"{tmpdir}")
sys.path.insert(0, r"{Path('.').absolute()}")
from scripts.build_catalog import build_catalog
build_catalog()
"""
            res = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
            self.assertEqual(res.returncode, 0, msg=f"build_catalog failed: {res.stderr}\n{res.stdout}")

            catalog_path = tmppath / "public" / "api" / "catalog.json"
            self.assertTrue(catalog_path.exists())
            catalog = json.loads(catalog_path.read_text(encoding="utf-8"))

            plugin = catalog["plugins"][0]
            self.assertFalse(plugin["publisher"]["is_verified"], "Unverified publisher was marked verified!")
            self.assertNotIn("is_verified", plugin, "is_verified should be removed from plugin root object")

    def test_validate_plugin_rejects_self_verification(self):
        """Test that validate_plugin.py rejects manifests declaring is_verified: true."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)
            pub_dir = tmppath / "publishers"
            pub_dir.mkdir()
            (pub_dir / "attacker.json").write_text(json.dumps({
                "id": "attacker", "name": "Attacker"
            }), encoding="utf-8")

            manifest_dir = tmppath / "manifests" / "a" / "attacker" / "bad-plugin" / "1.0.0"
            manifest_dir.mkdir(parents=True)
            manifest = {
                "id": "bad-plugin",
                "name": "Bad Plugin",
                "version": "1.0.0",
                "author": "attacker",
                "conversions": ["ISO"],
                "is_verified": True
            }
            manifest_file = manifest_dir / "manifest.json"
            manifest_file.write_text(json.dumps(manifest), encoding="utf-8")

            code = f"""
import sys
from pathlib import Path
import os
os.chdir(r"{tmpdir}")
sys.path.insert(0, r"{Path('.').absolute()}")
from scripts.validate_plugin import validate_manifest
valid = validate_manifest(Path(r"{manifest_file}"))
sys.exit(0 if valid else 1)
"""
            res = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
            self.assertNotEqual(res.returncode, 0, "validate_plugin should have rejected self-verified manifest!")
            self.assertIn("Security Violation", res.stdout)

    def test_validate_plugin_rejects_path_mismatch(self):
        """Test that validate_plugin.py rejects manifests where author != path publisher_id."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)
            pub_dir = tmppath / "publishers"
            pub_dir.mkdir()
            (pub_dir / "victim.json").write_text(json.dumps({
                "id": "victim", "name": "Victim"
            }), encoding="utf-8")

            # Manifest in attacker directory claiming author is victim
            manifest_dir = tmppath / "manifests" / "a" / "attacker" / "impostor-plugin" / "1.0.0"
            manifest_dir.mkdir(parents=True)
            manifest = {
                "id": "impostor-plugin",
                "name": "Impostor Plugin",
                "version": "1.0.0",
                "author": "victim",
                "conversions": ["ISO"]
            }
            manifest_file = manifest_dir / "manifest.json"
            manifest_file.write_text(json.dumps(manifest), encoding="utf-8")

            code = f"""
import sys
from pathlib import Path
import os
os.chdir(r"{tmpdir}")
sys.path.insert(0, r"{Path('.').absolute()}")
from scripts.validate_plugin import validate_manifest
valid = validate_manifest(Path(r"{manifest_file}"))
sys.exit(0 if valid else 1)
"""
            res = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
            self.assertNotEqual(res.returncode, 0, "validate_plugin should have rejected path mismatch!")
            self.assertIn("Security Violation", res.stdout)

if __name__ == "__main__":
    unittest.main()
