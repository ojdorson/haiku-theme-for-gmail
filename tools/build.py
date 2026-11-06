#!/usr/bin/env python3
"""Build the releases for Chrome and Firefox from the same sources.

Writes, for each browser, an unpacked folder and a zip:

    dist/haiku-theme-for-gmail-chrome/   dist/haiku-theme-for-gmail-<version>-chrome.zip
    dist/haiku-theme-for-gmail-firefox/  dist/haiku-theme-for-gmail-<version>-firefox.zip

The working folder is the development build (it loads dev-bg.js and
dev-content.js, which talk to tools/devserver.py). The releases leave those
out, inject haiku.css through the manifest instead of hot-swapping it, and
ask for no permissions beyond running on mail.google.com.

Browser differences live here, not in the sources:
  - Chrome resolves url() in a content-script stylesheet against the page,
    so haiku.css spells icons as chrome-extension://__MSG_@@extension_id__/...
    Firefox resolves them against the stylesheet inside the extension, so
    the Firefox build rewrites those to plain relative paths (icons/...).
  - Firefox needs an add-on ID and a minimum version (:has() is 121+);
    Chrome takes minimum_chrome_version (:has() is 105+).

Usage:  python3 tools/build.py
"""
import json
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SHIP = ["haiku.js", "README.md", "LICENSE", "CREDITS.md", "CHANGELOG.md"]
GMAIL = "https://mail.google.com/*"
CHROME_ICON_URL = "chrome-extension://__MSG_@@extension_id__/icons/"
GECKO_ID = "haiku-theme-for-gmail@ojdorson.github.io"

dev = json.loads((ROOT / "manifest.json").read_text())
css = (ROOT / "haiku.css").read_text()
assert CHROME_ICON_URL in css, "haiku.css no longer uses the Chrome icon URL the Firefox build rewrites"

base = {
    "manifest_version": 3,
    "name": dev["name"],
    "version": dev["version"],
    "description": dev["description"],
    "icons": dev["icons"],
    "content_scripts": [
        {"matches": [GMAIL], "css": ["haiku.css"], "js": ["haiku.js"], "run_at": "document_idle"},
    ],
    "web_accessible_resources": [{"resources": ["icons/*.svg"], "matches": [GMAIL]}],
}

TARGETS = {
    "chrome": {
        "manifest": {**base, "minimum_chrome_version": "105"},
        "css": css,
    },
    "firefox": {
        "manifest": {
            **base,
            "browser_specific_settings": {"gecko": {
                "id": GECKO_ID,
                "strict_min_version": "121.0",
                # Firefox's data-collection declaration: none.
                "data_collection_permissions": {"required": ["none"]},
            }},
        },
        "css": css.replace(CHROME_ICON_URL, "icons/"),
    },
}

# Store limits (Chrome Web Store; addons.mozilla.org allows more).
assert len(base["description"]) <= 132, f"description is {len(base['description'])} chars; the Chrome Web Store allows 132"
assert len(base["name"]) <= 75, "name is longer than the Chrome Web Store's 75 characters"

# Old versions are on GitHub's Releases page and tagged in git; keep only
# this build's zips. To rebuild a shipped version, build from its tag.
for old in DIST.glob("haiku-theme-for-gmail-*.zip"):
    old.unlink()

for browser, target in TARGETS.items():
    out = DIST / f"haiku-theme-for-gmail-{browser}"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for name in SHIP:
        shutil.copy2(ROOT / name, out / name)
    (out / "haiku.css").write_text(target["css"])
    shutil.copytree(ROOT / "icons", out / "icons")
    manifest = target["manifest"]
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    # Every file the manifest names must exist; no dev files.
    for path in [*manifest["icons"].values(), "haiku.css", "haiku.js"]:
        assert (out / path).is_file(), f"{browser}: missing {path}"
    assert not any(out.glob("dev-*")), f"{browser}: dev files leaked into the release"
    if browser == "firefox":
        assert "chrome-extension://" not in target["css"], "firefox: Chrome-only URL left in haiku.css"

    archive = DIST / f"haiku-theme-for-gmail-{manifest['version']}-{browser}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(out.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(out))
    print(f"built {out.relative_to(ROOT)}/ and {archive.relative_to(ROOT)}")
