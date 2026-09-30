#!/usr/bin/env python3
"""Replaces invisible/irregular whitespace characters in source files with \\uXXXX escapes.

Usage: python3 scripts/escape-invisible-chars.py [paths...]
"""
import pathlib
import re
import sys

CHARS = re.compile('[  -‍    ⁠　﻿]')
EXTENSIONS = {'.ts', '.tsx', '.js', '.mjs'}
roots = [pathlib.Path(p) for p in (sys.argv[1:] or ['packages', 'apps', 'e2e', 'scripts'])]
changed = 0
for root in roots:
    files = [root] if root.is_file() else root.rglob('*')
    for path in files:
        if path.suffix not in EXTENSIONS or 'node_modules' in path.parts or 'dist' in path.parts:
            continue
        text = path.read_text(encoding='utf-8')
        fixed = CHARS.sub(lambda m: '\\u%04X' % ord(m.group(0)), text)
        if fixed != text:
            path.write_text(fixed, encoding='utf-8')
            changed += 1
            print(f'escaped invisible characters in {path}')
print(f'{changed} file(s) changed')
