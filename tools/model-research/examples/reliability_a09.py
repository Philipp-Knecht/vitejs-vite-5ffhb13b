# BEREITS ANGEWENDET – nicht erneut ausführen. Beispiel dafür, wie Noten und Hinweise nach dem
# Abgleich mit der ADAC-Pannenstatistik gesetzt wurden (siehe README.md).
"""A09: reliability notes checked against the ADAC Pannenstatistik 2025/2026; small generation fixes."""
import json
import sys

P25 = {'label': 'ADAC Pannenstatistik 2025',
       'url': 'https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf'}
P26 = {'label': 'ADAC Pannenstatistik 2026',
       'url': 'https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/'}

UPDATES = {
    'toyota-aygo': (4, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 hatte der Aygo mit Erstzulassung 2015 bis 2022 in jedem Jahrgang weniger '
        'Pannen als die meisten gleich alten Autos; die Pannenstatistik 2026 zählt ihn zu den zuverlässigsten '
        'Kleinstwagen. Den Aygo I sah der ADAC überwiegend im Bereich „gut“, beim TÜV fällt er häufiger durch Bremsen '
        'und Beleuchtung auf.'),
    'citroen-c1': (4, [P26],
        'Den C1 I sah der ADAC in der Pannenstatistik im Bereich „gut“ bis „sehr gut“, beim TÜV schneidet er aber '
        'schlechter ab als der Durchschnitt. Für den C1 selbst weist der ADAC keine aktuellen Werte aus; den '
        'baugleichen Toyota Aygo zählt die Pannenstatistik 2026 zu den zuverlässigsten Kleinstwagen.'),
    'hyundai-i10': (3, [P25],
        'Laut ADAC-Pannenstatistik 2025 liegt der i10 der dritten Generation (Erstzulassung 2020 bis 2022) im '
        'Mittelfeld, die Jahrgänge 2017 bis 2019 des Vorgängers hatten dagegen deutlich mehr Pannen als die meisten '
        'gleich alten Autos. Beim TÜV schneidet der i10 laut ADAC unterdurchschnittlich ab.'),
    'hyundai-i20': (3, [P25],
        'Laut ADAC-Pannenstatistik 2025 liegt der i20 mit Erstzulassung 2015 bis 2021 überwiegend im Mittelfeld (2019 '
        'und 2020 besser), der Jahrgang 2022 hatte aber deutlich mehr Pannen als die meisten gleich alten Autos. Die '
        'erste Generation (2009–2014) schnitt laut ADAC schlecht bis sehr schlecht ab und liegt auch beim TÜV weit '
        'unter dem Durchschnitt.'),
    'hyundai-i30': (3, [P25],
        'Laut ADAC-Pannenstatistik 2025 liegt der i30 der dritten Generation mit Erstzulassung 2017 bis 2019 im '
        'Mittelfeld, 2020 bis 2022 hatte er weniger Pannen als die meisten gleich alten Autos. Die zweite Generation '
        'lag laut ADAC überwiegend im Mittelfeld, die erste schnitt schwach ab; beim TÜV liegen beide unter dem '
        'Durchschnitt.'),
}

repo = sys.argv[1]
P = f'{repo}/packages/catalog/data/models/'


def load(mid):
    return json.load(open(P + mid + '.json', encoding='utf-8'))


def save(model):
    with open(P + model['id'] + '.json', 'w', encoding='utf-8') as out:
        json.dump(model, out, ensure_ascii=False, indent=2)
        out.write('\n')


for mid, (rating, sources, note) in UPDATES.items():
    model = load(mid)
    ratings = model['ratings']
    before = ratings['reliability']
    ratings['reliability'] = rating
    ratings['reliabilityNote'] = note
    urls = {s['url'] for s in ratings['reliabilitySources']}
    ratings['reliabilitySources'] += [s for s in sources if s['url'] not in urls]
    if mid == 'toyota-aygo':
        model['summary'] = ('Handlicher, sparsamer Kleinstwagen für die Stadt, der laut ADAC in der Pannenstatistik '
                            'gut abschneidet.')
        aygo1 = next(g for g in model['generations'] if g['id'] == 'toyota-aygo-i')
        if 'diesel' not in aygo1['fuels']:
            aygo1['fuels'].append('diesel')  # 1.4 D-4D, 2005–2007 (Wikipedia)
    save(model)
    print(f'{mid}: {before} -> {rating}')
