"""Parse 'Überdurchschnittlich häufig auftretende Mängel nach Baureihe' from the ADAC Pannenstatistik 2025 layout text.

Usage: python3 -I pannen2025_defects.py <layout.txt>  ->  JSON {model: [[defect, [years...]], ...]}
The appendix has two columns per page; the left column is read before the right one.
"""
import json
import re
import sys

YEARS = re.compile(r'^(.*?)\s*\(([\d\-–, ]+)\)\s*$')


def expand(spec):
    years = []
    for part in re.split(r',\s*', spec.strip()):
        if not part:
            continue
        bounds = re.split(r'[-–]', part)
        if len(bounds) == 2:
            years += list(range(int(bounds[0]), int(bounds[1]) + 1))
        else:
            years.append(int(bounds[0]))
    return years


def columns(path):
    text = open(path, encoding='utf-8').read()
    start = text.index('Überdurchschnittlich häufig auftretende Mängel')
    pages = re.split(r'^--- page \d+ ---$', text[start:], flags=re.M)
    out = []
    for page in pages:
        left, right = [], []
        for line in page.split('\n'):
            if 'ADAC e.V.' in line or 'Pannenstatistik 2025 -' in line or 'Anhang zur' in line:
                continue
            # The PDF spaces out year ranges: "(2015         -2016)".
            line = re.sub(r'(\d{4})\s+-\s*(\d{4})', r'\1-\2', line)
            for m in re.finditer(r'\S(?:.*?\S)?(?=\s{6,}|\s*$)', line):
                (left if m.start() < 40 else right).append(m.group())
            if not line.strip():
                left.append('')
                right.append('')
        out += left + [''] + right + ['']
    return out


def parse(path):
    result = {}
    model, pending, name_parts = None, None, []

    def close_name():
        nonlocal model, name_parts
        if name_parts:
            model = ' '.join(name_parts)
            result.setdefault(model, [])
            name_parts = []

    for raw in columns(path):
        line = raw.strip()
        if line.startswith('Überdurchschnittlich') or line == 'nach Baureihe':
            continue
        if not line:
            if not pending:
                close_name()
            continue
        if pending:
            joiner = '' if line.startswith(('(', '-', ')')) or pending.endswith('-') else ' '
            line, pending = pending + joiner + line, None
        m = YEARS.match(line)
        if m and not m.group(1) and name_parts and model:
            # A defect whose years wrapped onto their own line.
            result[model].append([' '.join(name_parts), expand(m.group(2))])
            name_parts = []
            continue
        if m and (model or name_parts):
            close_name()
            result[model].append([m.group(1).strip(), expand(m.group(2))])
            continue
        if model and not name_parts and (line.endswith((',', '-')) or re.search(r'\([\d\-, ]*$', line)):
            pending = line
            continue
        name_parts.append(line)
    close_name()
    return {k: v for k, v in result.items() if v}


if __name__ == '__main__':
    print(json.dumps(parse(sys.argv[1]), ensure_ascii=False, indent=0))
