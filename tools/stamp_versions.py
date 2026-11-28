#!/usr/bin/env python3
"""Stamp each page's links to styles.css, script.js and places-map.js with a short hash of the file.

Browsers (Safari on iPhone especially) cache these files, and GitHub Pages lets them keep a copy for
10 minutes. Without a stamp, a visitor can get a new page with an old script or stylesheet, which breaks
things like the intro. A changed file gets a new stamp, so browsers always fetch the matching copy.

Run before each deploy:  python3 tools/stamp_versions.py
"""
import hashlib, re
from pathlib import Path

FILES = ["styles.css", "script.js", "places-map.js"]
stamps = {name: hashlib.sha1(Path(name).read_bytes()).hexdigest()[:8] for name in FILES if Path(name).exists()}
for page in sorted(Path(".").glob("*.html")):
    text = page.read_text()
    updated = text
    for name, stamp in stamps.items():
        updated = re.sub(rf'((?:href|src)="/?{re.escape(name)})(\?v=[0-9a-f]+)?"', rf'\1?v={stamp}"', updated)
    if updated != text:
        page.write_text(updated)
        print(f"stamped {page}")
print("versions:", stamps)
