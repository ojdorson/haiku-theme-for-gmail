#!/usr/bin/env python3
"""Upload and submit the Chrome build to the Chrome Web Store (API v2).

    python3 tools/cws.py status
    python3 tools/cws.py upload dist/haiku-theme-for-gmail-<v>-chrome.zip
    python3 tools/cws.py publish        # submit the uploaded version for review
    python3 tools/cws.py cancel         # withdraw a submission that is still in review

Authentication is keyless: gcloud (signed in as the publisher's owner)
impersonates the service account that is registered in the developer
dashboard (Account → Service accounts), and gets a short-lived token.
Settings, none of them secret, live in ~/.config/haiku-theme-for-gmail/cws.json:

    {"publisher": "<publisher id>", "item": "hbklabmgaphaoikehjpkkocdijbjnkco",
     "service_account": "cws-publisher@<project>.iam.gserviceaccount.com"}

Store listing text and images are not covered by the API; change them in
the dashboard.
"""
import json
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

CONFIG = pathlib.Path.home() / ".config" / "haiku-theme-for-gmail" / "cws.json"
SCOPE = "https://www.googleapis.com/auth/chromewebstore"
API = "https://chromewebstore.googleapis.com"


def token(cfg):
    return subprocess.run(
        ["gcloud", "auth", "print-access-token",
         f"--impersonate-service-account={cfg['service_account']}", f"--scopes={SCOPE}"],
        check=True, capture_output=True, text=True).stdout.strip()


def call(cfg, method, path, data=None, content_type=None, upload=False):
    url = f"{API}/{'upload/' if upload else ''}v2/publishers/{cfg['publisher']}/items/{cfg['item']}{path}"
    headers = {"Authorization": f"Bearer {token(cfg)}"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:800]}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("status", "upload", "publish", "cancel"):
        sys.exit(__doc__)
    cfg = json.loads(CONFIG.read_text())
    cmd = sys.argv[1]
    if cmd == "status":
        res = call(cfg, "GET", ":fetchStatus")
    elif cmd == "upload":
        if len(sys.argv) < 3:
            sys.exit("upload needs the -chrome.zip path")
        zip_path = pathlib.Path(sys.argv[2])
        assert zip_path.name.endswith("-chrome.zip"), "expected a -chrome.zip release package"
        res = call(cfg, "POST", ":upload", data=zip_path.read_bytes(),
                   content_type="application/zip", upload=True)
    elif cmd == "cancel":
        res = call(cfg, "POST", ":cancelSubmission", data=b"{}", content_type="application/json")
    else:
        res = call(cfg, "POST", ":publish", data=b"{}", content_type="application/json")
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
