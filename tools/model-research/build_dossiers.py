"""Downloads the ADAC "Gebrauchtwageninfo" PDFs found for each model and writes one compact
dossier per model: intro, recommendation, pros/cons, breakdown statistics (with the ADAC
band per year), defects and recalls – the model history and data tables are left out.
Usage: python3 -I build_dossiers.py [model ids...]"""
import json, pathlib, re, subprocess, sys, time

HERE = pathlib.Path(__file__).parent
from pypdf import PdfReader  # pip install pypdf

UA = 'Mozilla/5.0 (compatible; KaufCheck-Research/1.0; +https://kaufcheck-app.de)'
PDF_DIR = HERE / 'work' / 'pdf'
OUT_DIR = HERE / 'work' / 'dossiers'
PDF_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)
BANDS = ['sehr gut', 'gut', 'mittel', 'schlecht', 'sehr schlecht']

def urls_by_model():
    found = {}
    for file in sorted(HERE.glob('urls_*.jsonl')):
        for line in file.read_text(encoding='utf-8').splitlines():
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            for url in row.get('urls') or []:
                if re.match(r'^https://assets\.adac\.de/.*GWInfo/gw\d+[^/]*\.pdf$', url):
                    found.setdefault(row['id'], [])
                    if url not in found[row['id']]:
                        found[row['id']].append(url)
    return found

def download(url):
    target = PDF_DIR / url.rsplit('/', 1)[1]
    if not target.exists() or target.stat().st_size < 1000:
        result = subprocess.run(['curl', '-sS', '-L', '-m', '60', '-A', UA, '-o', str(target), '-w', '%{http_code}', url],
                                capture_output=True, text=True)
        time.sleep(1.0)
        if result.stdout.strip() != '200' or not target.read_bytes()[:4] == b'%PDF':
            target.unlink(missing_ok=True)
            return None
    return target

def numbers(line):
    return [float(v.replace('.', '').replace(',', '.')) for v in re.findall(r'\d+(?:\.\d{3})*,\d+|\d+', line)]

def annotate_breakdowns(text):
    """Adds the ADAC band ('gut', 'mittel', …) per registration year below the statistics."""
    lines = text.splitlines()
    try:
        y = next(i for i, l in enumerate(lines) if l.startswith('Erstzulassungsjahr'))
        r = next(i for i, l in enumerate(lines) if l.startswith('ADAC-Bewertung'))
        s = next(i for i, l in enumerate(lines) if l.startswith('ADAC-Bewertungsschema'))
    except StopIteration:
        return text
    years = [int(v) for v in re.findall(r'\b(?:19|20)\d{2}\b', lines[y])]
    values = numbers(lines[r].replace('ADAC-Bewertung', ''))
    rows = []
    for line in lines[s + 1:s + 12]:
        if re.fullmatch(r'[\d,.>\s]+', line.strip()) and len(re.findall(r'[\d,]+', line)) >= len(years):
            rows.append(numbers(line))
    if len(rows) < 6 or len(values) != len(years):
        return text
    thresholds = rows[1:5]  # first numeric row repeats the years
    bands = []
    for index, (year, value) in enumerate(zip(years, values)):
        band = BANDS[4]
        for level, row in enumerate(thresholds):
            if index < len(row) and value <= row[index]:
                band = BANDS[level]
                break
        bands.append(f'{year}: {band}')
    note = 'ADAC-Einstufung je Erstzulassungsjahr (niedrige Pannenkennziffer = besser): ' + ', '.join(bands)
    return '\n'.join(lines[:r + 1] + [note] + lines[r + 1:])

RECALL = re.compile(r'^\d{1,2}/\d{4}: ')

def shorten_recalls(text):
    """Keeps the first sentence of each recall (what was wrong); drops the workshop details."""
    out, current = [], None
    def flush():
        if current is not None:
            joined = ' '.join(current)
            cut = re.search(r'^(.{30,260}?[.!?])(?:\s|$)', joined)
            out.append(cut.group(1) if cut else joined[:260])
    for line in text.splitlines():
        if RECALL.match(line):
            flush(); current = [line.strip()]
        elif current is not None and line.strip() and not line.startswith(('Weitere und neuere', '===')):
            current.append(line.strip())
        else:
            flush(); current = None; out.append(line)
    flush()
    return '\n'.join(out)

def end_year(url):
    years = [int(y) for y in re.findall(r'(?<!\d)(19\d{2}|20\d{2})(?!\d)', url.rsplit('/', 1)[1])]
    return years[-1] if len(years) >= 2 else 9999

def extract(path):
    reader = PdfReader(str(path))
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\ufffd]', '', text)
    text = text.split('\nModellgeschichte', 1)[0]
    text = re.sub(r'Gebrauchtwageninfo: [^\n]*\nADAC e\. V\. \| 81360 München[^\n]*\n', '', text)
    text = re.sub(r'\n(?:\d{1,2}/\d{4}\n){2,}', '\n', text)  # date columns of the recall table
    return shorten_recalls(annotate_breakdowns(text.strip()))

def main(only):
    found = urls_by_model()
    for model_id, urls in sorted(found.items()):
        if only and model_id not in only:
            continue
        parts, missing = [], []
        # Generations that ended before 2010 are rarely bought today (kept if nothing else exists).
        recent = [url for url in urls if end_year(url) >= 2010] or urls
        for url in recent:
            path = download(url)
            if not path:
                missing.append(url)
                continue
            parts.append(f'=== QUELLE: {url}\n{extract(path)}')
        (OUT_DIR / f'{model_id}.txt').write_text('\n\n'.join(parts) + '\n', encoding='utf-8')
        print(f'{model_id}: {len(parts)} reports' + (f', {len(missing)} not loaded' if missing else ''))

if __name__ == '__main__':
    main(set(sys.argv[1:]))
