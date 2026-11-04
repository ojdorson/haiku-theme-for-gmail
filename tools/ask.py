#!/usr/bin/env python3
"""Send one query to a Gmail tab through tools/devserver.py; print the answer.

Usage:  python3 tools/ask.py '<json query>' [WORKDIR]

Query keys (all optional):
  selectors  list of CSS selectors to describe     limit   max matches (5)
  depth      child levels to include (0)           styles  computed styles
  points     [[x, y], ...] element chains          pseudo  selector whose
  match      only answer from a tab whose URL/name          ::before/::after
             contains this text                             are listed
  hash       navigate the tab to this #fragment
  press      selector to press (mouse events)      index   which match (0)
  focus      selector to focus                     hover   selector to hover
  vw         only answer from a tab this wide      settag  tag that tab (with vw)
  rules      selector; list stylesheet rules on it that set "prop"
             (or with "grep": every rule whose selector contains it)
  type       text to put in the focused field (fires input)
"""
import json
import pathlib
import random
import sys
import tempfile
import time

work = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(tempfile.gettempdir()) / "gmail-haiku-dev"
query = json.loads(sys.argv[1])
query["id"] = str(random.random())
(work / "result.json").unlink(missing_ok=True)
(work / "query.json").write_text(json.dumps(query))
for _ in range(50):
    result = work / "result.json"
    if result.exists() and result.stat().st_size:
        print(result.read_text())
        break
    time.sleep(0.2)
else:
    print("no result (is Gmail open and the dev build loaded?)", file=sys.stderr)
    sys.exit(1)
