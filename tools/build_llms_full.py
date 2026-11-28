#!/usr/bin/env python3
# (c) Alex Cutrupi. All rights reserved. See LICENSE.
"""Write llms-full.txt: the text of every page as plain Markdown, for AI assistants.

Run after editing page content (and before deploying):  python3 tools/build_llms_full.py
"""
from html.parser import HTMLParser
from pathlib import Path

PAGES = [("index.html", "Home", "https://alexcutrupi.com/"),
         ("past-projects.html", "Projects", "https://alexcutrupi.com/past-projects.html"),
         ("skills.html", "Skills", "https://alexcutrupi.com/skills.html"),
         ("education-career.html", "Education & Career", "https://alexcutrupi.com/education-career.html"),
         ("contact.html", "Contact", "https://alexcutrupi.com/contact.html")]
BLOCKS = {"h1": "# ", "h2": "## ", "h3": "### ", "h4": "#### ", "p": "", "li": "- ", "dt": "**", "dd": "", "figcaption": ""}
SKIP = {"svg", "script", "style", "button", "nav", "dialog"}

class Reader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_main = 0; self.skip = 0; self.stack = []; self.lines = []; self.buffer = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "main": self.in_main += 1
        if not self.in_main: return
        if tag in SKIP or a.get("aria-hidden") == "true": self.skip += 1; self.stack.append(("skip", tag)); return
        if tag in BLOCKS: self.flush(); self.stack.append(("block", tag))
        else:
            self.buffer.append(" ")  # Side-by-side links and tags shouldn't run together.
            self.stack.append(("inline", tag))
    def handle_endtag(self, tag):
        if tag == "main": self.flush(); self.in_main -= 1; return
        if not self.in_main or not self.stack: return
        kind, opened = self.stack.pop()
        if kind == "skip": self.skip -= 1
        elif kind == "block": self.flush(opened)
    def handle_data(self, data):
        if self.in_main and not self.skip: self.buffer.append(data)
    def flush(self, tag=None):
        text = " ".join("".join(self.buffer).split())
        self.buffer = []
        if not text or tag is None: return
        prefix = BLOCKS.get(tag, "")
        line = f"**{text}**" if tag == "dt" else prefix + text
        if tag in ("h1", "h2", "h3", "h4"): self.lines.append("")
        self.lines.append(line)

out = ["# Alex Cutrupi: full site text", "", "> Every page of https://alexcutrupi.com/ as plain text. A shorter profile is at https://alexcutrupi.com/llms.txt", ""]
for file, name, url in PAGES:
    reader = Reader(); reader.feed(Path(file).read_text())
    out += ["", "---", "", f"Page: {name} ({url})", ""] + [line for line in reader.lines]
Path("llms-full.txt").write_text("\n".join(out).replace("\n\n\n", "\n\n").strip() + "\n")
print(f"wrote llms-full.txt ({len(out)} lines)")
