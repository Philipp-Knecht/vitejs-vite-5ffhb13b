"""Imports researched models (work/models/<id>.json, one object or an array) into packages/catalog/data/models/<id>.json.

Keeps only well-formed, sourced entries; prints what it dropped so it can be reviewed.
Usage: python3 -I import_research.py <repo root> <batch.json>...
"""
import json, re, sys, pathlib
from urllib.parse import urlparse

repo = pathlib.Path(sys.argv[1])
models_ts = (repo / 'packages/catalog/src/models.ts').read_text(encoding='utf-8')
makes_ts = (repo / 'packages/catalog/src/makes.ts').read_text(encoding='utf-8')
# Catalog rows: ['vw-golf', 'Golf', 'kompakt', …] – names and classes of the catalog win.
CATALOG = {m[0]: {'model': m[1], 'segment': m[2]} for m in re.findall(r"\[\s*'([a-z0-9-]+)',\s*'([^']+)',\s*'([a-z_]+)'", models_ts)}
catalog_ids = set(CATALOG)
MAKE_NAMES = dict(re.findall(r"id: '([a-z0-9-]+)',\s*name: '([^']+)'", makes_ts))
def make_name(model_id):
    candidates = [make for make in MAKE_NAMES if model_id.startswith(make + '-')]
    return MAKE_NAMES[max(candidates, key=len)] if candidates else None
out_dir = repo / 'packages/catalog/data/models'
out_dir.mkdir(parents=True, exist_ok=True)

MARKETPLACE_LISTING = re.compile(
    r'(mobile\.de/(fahrzeuge|auto-inserat)|autoscout24\.[a-z.]+/(angebote|lst)|kleinanzeigen\.de/s-|ebay\.[a-z.]+/(itm|sch)|facebook\.com/marketplace|pkw\.de/fahrzeuge|autohero\.com/[a-z]{2}/[^/]+/id/)'
)
SEGMENTS = {'kleinstwagen','kleinwagen','kompakt','mittelklasse','obere_mittelklasse','oberklasse','suv_klein','suv_kompakt','suv_mittel','suv_gross','van_klein','van','hochdachkombi','bus','sportwagen'}
BODIES = {'limousine','schraegheck','kombi','suv','van','cabrio','coupe','pickup','bus'}
FUELS = {'petrol','diesel','electric','hybrid','plugin_hybrid','lpg','cng','hydrogen','ethanol','other'}

def good_source(source):
    if not isinstance(source, dict): return False
    url = source.get('url') or ''
    label = (source.get('label') or '').strip()
    parsed = urlparse(url)
    return parsed.scheme == 'https' and parsed.netloc and len(label) >= 2 and not MARKETPLACE_LISTING.search(url)

def clean_sources(sources):
    seen, result = set(), []
    for source in sources or []:
        if good_source(source) and source['url'] not in seen:
            seen.add(source['url'])
            result.append({'label': source['label'].strip()[:160], 'url': source['url']})
    return result

def clip(text, limit):
    text = re.sub(r'\s+', ' ', str(text or '')).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + '…'

report = []
for batch in sys.argv[2:]:
    data = json.loads(pathlib.Path(batch).read_text(encoding='utf-8'))
    for model in (data if isinstance(data, list) else [data]):
        mid = model.get('id')
        if mid not in catalog_ids:
            report.append(f'SKIP model {mid}: not in catalog'); continue
        catalog = CATALOG[mid]
        if model.get('segment') != catalog['segment']:
            report.append(f'{mid}: segment {model.get("segment")} -> catalog {catalog["segment"]}')
        for key, value in (('make', make_name(mid)), ('model', catalog['model'])):
            if value and model.get(key) != value:
                report.append(f'{mid}: {key} {model.get(key)!r} -> catalog {value!r}')
                model[key] = value
        model['segment'] = catalog['segment']
        ratings = model.get('ratings') or {}
        def rating(key):
            value = ratings.get(key)
            return value if isinstance(value, int) and 1 <= value <= 5 else 3
        generations = []
        for gen in model.get('generations') or []:
            gid = str(gen.get('id') or '')
            if not gid.startswith(mid + '-'):
                gid = f"{mid}-{re.sub(r'[^a-z0-9]+', '-', gid.lower()).strip('-') or len(generations) + 1}"
            years = gen.get('years') or []
            if len(years) != 2 or not isinstance(years[0], int):
                report.append(f'{gid}: bad years {years}'); continue
            issues = []
            for issue in gen.get('issues') or []:
                sources = clean_sources(issue.get('sources'))
                if not sources:
                    report.append(f'{gid}: dropped unsourced issue "{issue.get("title")}"'); continue
                severity = issue.get('severity') if issue.get('severity') in ('hoch', 'mittel', 'gering') else 'mittel'
                issues.append({
                    'title': clip(issue.get('title'), 120),
                    'affects': clip(issue.get('affects') or 'siehe Quelle', 240),
                    'detail': clip(issue.get('detail'), 600),
                    'check': clip(issue.get('check') or 'Beim Verkäufer nachfragen und bei der Besichtigung prüfen.', 400),
                    'severity': severity,
                    'sources': sources,
                })
            price = gen.get('typicalPriceEur')
            price_source = gen.get('priceSource')
            if not (isinstance(price, list) and len(price) == 2 and all(isinstance(v, int) for v in price) and price_source and good_source(price_source)):
                price, price_source = None, None
            engines = gen.get('engines') or {}
            def notes(items):
                return [{'name': clip(i.get('name'), 120), 'why': clip(i.get('why'), 400)} for i in (items or []) if isinstance(i, dict) and i.get('name') and i.get('why')][:6]
            tips = [clip(t, 300) for t in gen.get('tips') or []][:6]
            # "Few experiences yet" only fits young generations; older ones simply lack a report.
            if not gen.get('issues') and years[0] <= 2021:
                tips = [t for t in tips if 'noch wenige' not in t] or [
                    'Zu dieser Generation haben wir noch keine Schwachstellen ausgewertet. Lass das Auto vor dem Kauf in einer Werkstatt prüfen und Rückrufe per Fahrgestellnummer erfragen.'
                ]
            generations.append({
                'id': gid,
                'name': clip(gen.get('name'), 80),
                'code': clip(gen.get('code'), 80) if gen.get('code') else None,
                'years': [years[0], years[1] if isinstance(years[1], int) else None],
                'bodyTypes': [b for b in gen.get('bodyTypes') or [] if b in BODIES] or ['schraegheck'],
                'fuels': [f for f in gen.get('fuels') or [] if f in FUELS] or ['petrol'],
                'seats': [s for s in gen.get('seats') or [] if isinstance(s, int) and 1 <= s <= 9] or [5],
                'automatic': bool(gen.get('automatic')),
                'typicalPriceEur': price,
                'priceSource': {'label': price_source['label'], 'url': price_source['url']} if price_source else None,
                'strengths': [clip(s, 240) for s in gen.get('strengths') or []][:6],
                'issues': issues[:8],
                'engines': {'recommended': notes(engines.get('recommended')), 'caution': notes(engines.get('caution'))},
                'tips': tips,
            })
        if not generations:
            report.append(f'SKIP model {mid}: no usable generation'); continue
        generations.sort(key=lambda g: g['years'][0])
        result = {
            'id': mid,
            'make': clip(model.get('make'), 40),
            'model': clip(model.get('model'), 60),
            'aliases': sorted({clip(a, 60).lower() for a in model.get('aliases') or [] if a}),
            'segment': model['segment'],
            'summary': clip(model.get('summary'), 400),
            'ratings': {
                'reliability': rating('reliability'),
                'reliabilityNote': clip(ratings.get('reliabilityNote') or 'Einschätzung aus TÜV-Report und ADAC-Pannenstatistik.', 400),
                'reliabilitySources': clean_sources(ratings.get('reliabilitySources')),
                'runningCosts': rating('runningCosts'),
                'space': rating('space'),
                'comfort': rating('comfort'),
            },
            'generations': generations,
        }
        twin = model.get('twinOf')
        if twin and twin in catalog_ids and twin != mid:
            result['twinOf'] = twin
        (out_dir / f'{mid}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        report.append(f'WROTE {mid}: {len(generations)} generations, {sum(len(g["issues"]) for g in generations)} issues')

print('\n'.join(report))
