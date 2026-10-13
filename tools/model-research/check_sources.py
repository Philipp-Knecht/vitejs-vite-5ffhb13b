"""Checks that every source URL in data/models/*.json answers (catches invented links).
Usage: python3 -I check_sources.py <repo> [model ids...]  – results cached in sources_cache.json"""
import json, sys, pathlib, subprocess, time
repo = pathlib.Path(sys.argv[1])
only = set(sys.argv[2:])
cache_file = pathlib.Path(__file__).parent / 'work' / 'sources_cache.json'
cache_file.parent.mkdir(parents=True, exist_ok=True)
cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
urls = {}
for f in sorted((repo / 'packages/catalog/data/models').glob('*.json')):
    model = json.loads(f.read_text(encoding='utf-8'))
    if only and model['id'] not in only: continue
    def add(src):
        if src: urls.setdefault(src['url'], set()).add(model['id'])
    for s in model['ratings']['reliabilitySources']: add(s)
    for g in model['generations']:
        add(g.get('priceSource'))
        for i in g['issues']:
            for s in i['sources']: add(s)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
def status(url):
    for method in (['-I'], ['-r', '0-0', '-o', '/dev/null']):
        out = subprocess.run(['curl', '-sS', '-L', '-m', '25', '-A', UA, *method, '-w', '%{http_code}', '-o', '/dev/null', url],
                             capture_output=True, text=True)
        code = out.stdout.strip()[-3:]
        if code and code not in ('405', '403', '000'): return code
    return code or '000'
bad = []
for url, ids in sorted(urls.items()):
    if url not in cache or cache[url] in ('000', '429'):
        cache[url] = status(url); time.sleep(0.3)
    code = cache[url]
    if not code.startswith(('2', '3')):
        bad.append((code, url, sorted(ids)))
cache_file.write_text(json.dumps(cache, indent=1))
print(f'{len(urls)} urls, {len(bad)} not OK')
for code, url, ids in bad: print(code, url, ','.join(ids))
