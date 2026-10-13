# BEREITS ANGEWENDET – nicht erneut ausführen. Beispiel dafür, wie Noten und Hinweise nach dem
# Abgleich mit der ADAC-Pannenstatistik gesetzt wurden (siehe README.md).
"""A11: reliability checked against the ADAC Pannenstatistik 2025/2026; mild hybrids completed."""
import json
import sys

P25 = {'label': 'ADAC Pannenstatistik 2025',
       'url': 'https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf'}
P26 = {'label': 'ADAC Pannenstatistik 2026',
       'url': 'https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/'}

UPDATES = {
    'audi-q3': (4, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 hatte der Q3 der zweiten Generation (Erstzulassung 2019 bis 2022) weniger '
        'Pannen als die meisten gleich alten Autos, die erste Generation (2015 bis 2017) gehört sogar zu den 15 Prozent '
        'mit den wenigsten Pannen; die Pannenstatistik 2026 zählt den Q3 zu den zuverlässigsten seiner Klasse. Beim '
        'TÜV schneidet er laut ADAC weit überdurchschnittlich ab.',
        'Kompakter, hochwertig verarbeiteter Premium-SUV, der laut ADAC zuverlässig ist, aber nur einen relativ kleinen '
        'Kofferraum bietet.'),
    'seat-ibiza': (4, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 hatte der Ibiza der fünften Generation (Erstzulassung 2018 bis 2022) in jedem '
        'Jahrgang weniger Pannen als die meisten gleich alten Autos, die Pannenstatistik 2026 zählt ihn zu den '
        'zuverlässigsten Kleinwagen. Den Vorgänger (2008–2017) sah der ADAC meist im Mittelfeld, beim TÜV schneidet er '
        'unterdurchschnittlich ab.',
        'Praktischer Kleinwagen mit einfacher Bedienung und großem Kofferraum; die aktuelle Generation (ab 2017) '
        'schneidet laut ADAC in der Pannenstatistik gut ab.'),
    'seat-leon': (4, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 hatte der Leon mit Erstzulassung 2015 bis 2022 in jedem Jahrgang weniger Pannen '
        'als die meisten gleich alten Autos, die Pannenstatistik 2026 zählt ihn zu den zuverlässigsten seiner Klasse. '
        'Beim TÜV liegen Leon 1P und 5F laut ADAC im Durchschnitt oder leicht darüber.',
        None),
}
FUELS = {'audi-a4-b9': 'hybrid', 'audi-a6-c8': 'hybrid', 'audi-a6-c9': 'hybrid', 'seat-leon-kl': 'hybrid'}

repo = sys.argv[1]
P = f'{repo}/packages/catalog/data/models/'
for mid in ['audi-a4', 'audi-a6', 'audi-q3', 'seat-ibiza', 'seat-leon']:
    model = json.load(open(P + mid + '.json', encoding='utf-8'))
    if mid in UPDATES:
        rating, sources, note, summary = UPDATES[mid]
        ratings = model['ratings']
        print(f"{mid}: {ratings['reliability']} -> {rating}")
        ratings['reliability'] = rating
        ratings['reliabilityNote'] = note
        urls = {s['url'] for s in ratings['reliabilitySources']}
        ratings['reliabilitySources'] += [s for s in sources if s['url'] not in urls]
        if summary:
            model['summary'] = summary
    for generation in model['generations']:
        fuel = FUELS.get(generation['id'])
        if fuel and fuel not in generation['fuels']:
            generation['fuels'].append(fuel)
    with open(P + mid + '.json', 'w', encoding='utf-8') as out:
        json.dump(model, out, ensure_ascii=False, indent=2)
        out.write('\n')
