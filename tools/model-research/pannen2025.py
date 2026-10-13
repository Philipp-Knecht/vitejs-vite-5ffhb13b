"""Parse the ADAC Pannenstatistik 2025 tables (layout text) and classify each value.

Usage: python3 -I pannen2025.py <layout.txt> [name-substring ...]
Prints JSON lines: {"name", "table", "km", "years": {year: [value, grade]}}.
Columns are calibrated per page from rows with all eight values.
"""
import json
import re
import sys

YEARS = [2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015]
# Upper bounds per EZ year: sehr gut, gut, mittel, schlecht (above = sehr schlecht).
LIMITS = {
    2022: (1.2, 6.1, 10.9, 15.8),
    2021: (2.0, 9.4, 16.9, 24.3),
    2020: (3.0, 12.3, 21.5, 30.8),
    2019: (4.3, 13.1, 21.9, 30.7),
    2018: (6.8, 13.8, 20.9, 27.9),
    2017: (7.6, 15.2, 22.9, 30.5),
    2016: (8.7, 15.2, 21.8, 28.3),
    2015: (10.7, 16.5, 22.3, 28.1),
}
GRADES = ['sehr gut', 'gut', 'mittel', 'schlecht', 'sehr schlecht']
ROW = re.compile(r'^\s*([A-Z][^\d].*?\S)\s{2,}(\d{1,2})(?=\s{2,}\d|\s*$)(.*)$')
NUM = re.compile(r'\d+(?:,\d)?')


def grade(year, value):
    for limit, name in zip(LIMITS[year], GRADES):
        if value <= limit:
            return name
    return GRADES[-1]


def pages(path):
    page = []
    for line in open(path, encoding='utf-8'):
        if line.startswith('--- page '):
            if page:
                yield page
            page = []
        else:
            page.append(line.rstrip('\n'))
    if page:
        yield page


def parse(path):
    """Rows of one table on one page form a block; full rows calibrate the block's columns."""
    rows = []
    table = None
    header = None
    for lines in pages(path):
        blocks, block = [], []
        for line in lines:
            if 'Laufleistung' in line and '2022' in line:
                header = [m.start() + 2 for m in re.finditer(r'20(?:22|21|20|19|18|17|16|15)', line)]
            head = re.match(r'^\s*(Kleinstwagen|Kleinwagen|Untere Mittelklasse|Mittelklasse|Obere Mittelklasse|Oberklasse|Transporter/Vans)\b', line)
            if head:
                table = head.group(1)
            m = ROW.match(line)
            ok = m and len(m.group(1)) <= 45 and not m.group(1).endswith(('.', ':'))
            if ok:
                toks = list(NUM.finditer(m.group(3)))
                ok = toks and all(',' in t.group() or len(t.group()) <= 2 for t in toks)
            if ok:
                tokens = [((t.start() + t.end()) / 2 + m.start(3), float(t.group().replace(',', '.'))) for t in toks]
                block.append((m.group(1), int(m.group(2)), tokens, table, header))
            elif line.strip():
                if block:
                    blocks.append(block)
                block = []
        if block:
            blocks.append(block)
        for block in blocks:
            full = [c[2] for c in block if len(c[2]) == 8]
            columns = [sum(r[i][0] for r in full) / len(full) for i in range(8)] if full else block[0][4]
            for name, km, tokens, tab, _ in block:
                years = {}
                for center, value in tokens:
                    idx = min(range(8), key=lambda i: abs(columns[i] - center))
                    years[YEARS[idx]] = [value, grade(YEARS[idx], value)]
                row = {'name': name, 'table': tab, 'km': km, 'years': years}
                if len(years) != len(tokens):
                    row['warning'] = 'column clash'
                if not full:
                    row['warning'] = row.get('warning', 'header columns')
                rows.append(row)
    return rows


if __name__ == '__main__':
    rows = parse(sys.argv[1])
    wanted = [w.lower() for w in sys.argv[2:]]
    for row in rows:
        if not wanted or any(w in row['name'].lower() for w in wanted):
            print(json.dumps(row, ensure_ascii=False))
