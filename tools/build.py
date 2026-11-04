#!/usr/bin/env python3
"""Build the release: dist/haiku-theme-for-gmail/ (unpacked) and dist/haiku-theme-for-gmail-<version>.zip.

The working folder is the development build (it loads dev-bg.js and
dev-content.js, which talk to tools/devserver.py). The release leaves those
out, injects haiku.css through the manifest instead of hot-swapping it, and
asks for no permissions beyond running on mail.google.com.

Usage:  python3 tools/build.py
"""
import json
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = DIST / "haiku-theme-for-gmail"
SHIP = ["haiku.css", "haiku.js", "README.md", "LICENSE", "CREDITS.md", "CHANGELOG.md"]
GMAIL = "https://mail.google.com/*"

dev = json.loads((ROOT / "manifest.json").read_text())
release = {
    "manifest_version": 3,
    "name": dev["name"],
    "version": dev["version"],
    "description": dev["description"],
    # haiku.css relies on :has() (Chrome 105+).
    "minimum_chrome_version": "105",
    "icons": dev["icons"],
    "content_scripts": [
        {"matches": [GMAIL], "css": ["haiku.css"], "js": ["haiku.js"], "run_at": "document_idle"},
    ],
    "web_accessible_resources": [{"resources": ["icons/*.svg"], "matches": [GMAIL]}],
}

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
for name in SHIP:
    shutil.copy2(ROOT / name, OUT / name)
shutil.copytree(ROOT / "icons", OUT / "icons")
(OUT / "manifest.json").write_text(json.dumps(release, indent=2) + "\n")

# Chrome Web Store limits (the upload is rejected otherwise).
assert len(release["description"]) <= 132, f"description is {len(release['description'])} chars; the Web Store allows 132"
assert len(release["name"]) <= 75, "name is longer than the Web Store's 75 characters"
# Every file the manifest names must exist.
for path in [*release["icons"].values(), "haiku.css", "haiku.js"]:
    assert (OUT / path).is_file(), f"missing {path}"
assert not any(OUT.glob("dev-*")), "dev files leaked into the release"

archive = DIST / f"haiku-theme-for-gmail-{release['version']}.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(OUT.rglob("*")):
        if f.is_file():
            z.write(f, f.relative_to(OUT))
print(f"built {OUT.relative_to(ROOT)}/ and {archive.relative_to(ROOT)}")
