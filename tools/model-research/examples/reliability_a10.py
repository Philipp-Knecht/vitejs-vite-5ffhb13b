# BEREITS ANGEWENDET – nicht erneut ausführen. Beispiel dafür, wie Noten und Hinweise nach dem
# Abgleich mit der ADAC-Pannenstatistik gesetzt wurden (siehe README.md).
"""A10: reliability checked against the ADAC Pannenstatistik 2025/2026; generation facts completed."""
import json
import sys

P25 = {'label': 'ADAC Pannenstatistik 2025',
       'url': 'https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf'}
P26 = {'label': 'ADAC Pannenstatistik 2026',
       'url': 'https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/'}

UPDATES = {
    'kia-picanto': (3, [P25],
        'Laut ADAC-Pannenstatistik 2025 liegt der Picanto der dritten Generation (ab 2017) im Mittelfeld, 2020 und '
        '2021 hatte er weniger Pannen als die meisten gleich alten Autos. Die älteren Generationen schnitten laut ADAC '
        'unterdurchschnittlich ab (Erstzulassung 2011–2014 „schlecht“), auch beim TÜV.'),
    'kia-ceed': (4, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte der Ceed der dritten Generation (Erstzulassung 2018 bis 2022, mit XCeed) '
        'in jedem Jahrgang weniger Pannen als die meisten gleich alten Autos. Den cee\'d JD sah der ADAC im Mittelfeld, '
        'der TÜV-Report fällt laut ADAC leicht unterdurchschnittlich aus.'),
    'kia-sportage': (4, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte der Sportage der vierten Generation (Erstzulassung 2017 bis 2021) weniger '
        'Pannen als die meisten gleich alten Autos; der neue Sportage (2022) liegt im Mittelfeld. Die dritte '
        'Generation sah der ADAC im Mittelfeld, beim TÜV schnitt sie klar unterdurchschnittlich ab.'),
    'audi-a3': (4, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 hatte der A3 mit Erstzulassung 2015 bis 2022 in jedem Jahrgang weniger Pannen '
        'als die meisten gleich alten Autos, die Pannenstatistik 2026 zählt ihn zu den zuverlässigsten seiner Klasse. '
        'Beim TÜV schneidet der A3 8V laut ADAC deutlich besser ab als der Durchschnitt.'),
}

# Mild hybrids (48 V) count as hybrid, as for the other models; the Rio left Europe in 2023.
FUELS = {'kia-rio-yb': 'hybrid', 'kia-ceed-cd': 'hybrid', 'kia-sportage-ql': 'hybrid', 'audi-a3-8y': 'hybrid'}
YEARS_END = {'kia-rio-yb': 2023}

repo = sys.argv[1]
P = f'{repo}/packages/catalog/data/models/'
for mid in ['kia-picanto', 'kia-rio', 'kia-ceed', 'kia-sportage', 'audi-a3']:
    model = json.load(open(P + mid + '.json', encoding='utf-8'))
    if mid in UPDATES:
        rating, sources, note = UPDATES[mid]
        ratings = model['ratings']
        print(f"{mid}: {ratings['reliability']} -> {rating}")
        ratings['reliability'] = rating
        ratings['reliabilityNote'] = note
        urls = {s['url'] for s in ratings['reliabilitySources']}
        ratings['reliabilitySources'] += [s for s in sources if s['url'] not in urls]
    for generation in model['generations']:
        fuel = FUELS.get(generation['id'])
        if fuel and fuel not in generation['fuels']:
            generation['fuels'].append(fuel)
        if generation['id'] in YEARS_END:
            generation['years'][1] = YEARS_END[generation['id']]
    with open(P + mid + '.json', 'w', encoding='utf-8') as out:
        json.dump(model, out, ensure_ascii=False, indent=2)
        out.write('\n')
