#!/usr/bin/env python3
"""Local tuning server for Haiku (BeOS) Theme for Gmail development (127.0.0.1 only).

Works with dev-bg.js / dev-content.js, which only exist in the unpacked
development build (tools/build.py leaves them out of the release):

  - haiku.css is hot-swapped into open Gmail tabs whenever it changes;
  - any other change reloads the extension (after 4s of quiet);
  - tools/ask.py sends a structure query (selectors, points, pseudo-elements,
    or a dev action such as navigating or pressing an element) to a Gmail
    tab and prints the JSON answer. Queries never return message bodies.

Usage:  python3 tools/devserver.py [WORKDIR]
WORKDIR holds query.json / result.json (default: a temp directory, printed
on start). Pass the same WORKDIR to tools/ask.py.
"""
import hashlib
import pathlib
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

EXT = pathlib.Path(__file__).resolve().parent.parent
WORK = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(tempfile.gettempdir()) / "gmail-haiku-dev"
WORK.mkdir(parents=True, exist_ok=True)


def version():
    """Changes when any shipped file other than haiku.css changes."""
    h = hashlib.sha1()
    for p in sorted(EXT.rglob("*")):
        if p.is_file() and p.name != "haiku.css" and "tools" not in p.parts and "dist" not in p.parts:
            h.update(str(p).encode())
            h.update(str(p.stat().st_mtime_ns).encode())
    return h.hexdigest()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, body, ctype="text/plain"):
        data = body.encode()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/version":
            return self.send(version())
        if self.path == "/cssversion":
            return self.send(str((EXT / "haiku.css").stat().st_mtime_ns))
        if self.path == "/file/haiku.css":
            return self.send((EXT / "haiku.css").read_text(), "text/css")
        if self.path == "/query":
            q = WORK / "query.json"
            return self.send(q.read_text() if q.exists() else "{}", "application/json")
        self.send("?")

    def do_POST(self):
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        (WORK / "result.json").write_bytes(data)
        (WORK / "query.json").unlink(missing_ok=True)
        self.send("ok")


if __name__ == "__main__":
    print(f"gmail-haiku dev server on 127.0.0.1:8765, workdir {WORK}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
