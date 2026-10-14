# BEREITS ANGEWENDET – nicht erneut ausführen. Beispiel dafür, wie Noten und Hinweise nach dem
# Abgleich mit der ADAC-Pannenstatistik gesetzt wurden (siehe README.md).
"""A08: reliability checked against the ADAC Pannenstatistik 2025/2026; Toyota battery issue from the 2026 report."""
import json
import sys

P25 = {'label': 'ADAC Pannenstatistik 2025',
       'url': 'https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf'}
P26 = {'label': 'ADAC Pannenstatistik 2026',
       'url': 'https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/'}

UPDATES = {
    'renault-megane': (3, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte der Mégane IV mit Erstzulassung 2017 und 2018 deutlich mehr Pannen als '
        'die meisten gleich alten Autos, ab 2020 dagegen weniger. Den Mégane III sah der ADAC im Mittelfeld (2016 '
        '„sehr schlecht“), beim TÜV schneidet er nicht sonderlich gut ab.'),
    'renault-captur': (4, [P25],
        'Laut ADAC kommt der Captur I in der Pannenstatistik auf sehr gute Werte, und auch der TÜV beanstandet wenig. '
        'Für den Captur II weist der ADAC nur gemeinsame Werte mit dem Clio aus: Erstzulassung 2021 und 2022 mit '
        'weniger Pannen als die meisten gleich alten Autos.'),
    'renault-twingo': (4, [P25],
        'Laut ADAC-Pannenstatistik 2025 liegt der Twingo III mit Erstzulassung 2015 bis 2019 überwiegend im '
        'Mittelfeld, ab 2020 hatte er weniger Pannen als die meisten gleich alten Autos. Den Twingo II sah der ADAC in '
        'der Pannenstatistik gut, beim TÜV aber unter dem Durchschnitt.'),
    'toyota-yaris': (2, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 und 2026 gehört der Yaris IV (Erstzulassung 2021 bis 2023) zu den Kleinwagen '
        'mit den meisten Pannen, fast immer wegen einer leeren 12-Volt-Starterbatterie; Toyota baut seit November 2024 '
        'größere Batterien ein. Ältere ADAC-Auswertungen sahen Yaris II und III überwiegend im Bereich „gut“.'),
    'toyota-corolla': (3, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 liegt der Corolla (ab 2019) in allen Jahrgängen im Mittelfeld, vor allem wegen '
        'Batteriepannen; die Pannenstatistik 2026 zählt den Jahrgang 2023 zu den Schlusslichtern seiner Klasse. Den '
        'Auris sah der ADAC früher überwiegend im Bereich „gut“, beim TÜV schneidet er sehr gut ab.'),
}

SUMMARIES = {
    'toyota-yaris': 'Japanischer Kleinwagen mit einfacher Bedienung, seit der dritten Generation auch als sparsamer '
                    'Hybrid; die vierte Generation fällt laut ADAC durch häufige Batteriepannen auf.',
    'toyota-corolla': 'Japanischer Kompaktwagen mit sparsamem Hybridantrieb, der in Europa von 2007 bis 2019 Auris '
                      'hieß und seitdem wieder Corolla heißt.',
}

CHECK = ('Fragen, ob die Batterie schon gegen eine größere getauscht wurde (Rechnung zeigen lassen), und die Batterie '
         'testen lassen; wer wenig fährt, sollte ein Ladegerät einplanen. Innerhalb der dreijährigen Neuwagengarantie '
         'tauscht Toyota eine auffällige Batterie laut eigener Aussage kostenlos.')

BATTERY = {
    'toyota-yaris-iv': {
        'title': 'Häufig leere 12-Volt-Starterbatterie',
        'affects': 'Yaris IV, laut ADAC vor allem Erstzulassung 2021–2023; größere Batterien baut Toyota seit dem '
                   'Produktionsmonat November 2024 ein.',
        'detail': 'Laut ADAC-Pannenstatistik 2026 hat der Yaris IV sehr viele Pannen, fast immer wegen einer defekten '
                  'oder leeren Startbatterie, vor allem bei Wenigfahrern. Toyota hat größere Batterien und eine '
                  'Batterie-Warnung in der MyToyota-App eingeführt.',
    },
    'toyota-corolla-e210': {
        'title': 'Häufig leere 12-Volt-Starterbatterie',
        'affects': 'Corolla ab 2019; laut ADAC überdurchschnittlich oft bei Erstzulassung 2019–2022, die '
                   'Pannenstatistik 2026 nennt den Jahrgang 2023 als besonders auffällig. Größere Batterien baut Toyota '
                   'beim Corolla seit dem Produktionsmonat Februar 2026 ein.',
        'detail': 'Laut ADAC-Pannenstatistik ist eine defekte oder leere Startbatterie beim Corolla die häufigste '
                  'Pannenursache, besonders bei Wenigfahrern.',
    },
}

repo = sys.argv[1]
P = f'{repo}/packages/catalog/data/models/'
for mid, (rating, sources, note) in UPDATES.items():
    model = json.load(open(P + mid + '.json', encoding='utf-8'))
    ratings = model['ratings']
    before = ratings['reliability']
    ratings['reliability'] = rating
    ratings['reliabilityNote'] = note
    urls = {s['url'] for s in ratings['reliabilitySources']}
    ratings['reliabilitySources'] += [s for s in sources if s['url'] not in urls]
    if mid in SUMMARIES:
        model['summary'] = SUMMARIES[mid]
    for generation in model['generations']:
        issue = BATTERY.get(generation['id'])
        if issue and not generation['issues']:
            generation['issues'].append({**issue, 'check': CHECK, 'severity': 'mittel', 'sources': [P26, P25]})
            generation['tips'] = [t for t in generation['tips'] if not t.startswith('Zu dieser Generation haben wir')]
            generation['tips'].append('Batterie und Ladezustand bei der Besichtigung testen lassen und Rückrufe per '
                                      'Fahrgestellnummer erfragen.')
    with open(P + mid + '.json', 'w', encoding='utf-8') as out:
        json.dump(model, out, ensure_ascii=False, indent=2)
        out.write('\n')
    print(f'{mid}: {before} -> {rating}')
