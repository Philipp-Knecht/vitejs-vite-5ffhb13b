# BEREITS ANGEWENDET – nicht erneut ausführen. Beispiel dafür, wie Noten und Hinweise nach dem
# Abgleich mit der ADAC-Pannenstatistik gesetzt wurden (siehe README.md).
"""Reliability ratings checked against the ADAC Pannenstatistik 2025 (per-year values) and 2026 (tops/flops)."""
import json
import sys

P25 = {'label': 'ADAC Pannenstatistik 2025',
       'url': 'https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf'}
P26 = {'label': 'ADAC Pannenstatistik 2026',
       'url': 'https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/'}

UPDATES = {
    'opel-insignia': (1, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 zählen die Insignia-Jahrgänge 2015 bis 2018 und 2022 zu den fünf Prozent der '
        'Autos mit den meisten Pannen, 2019 und 2021 liegen ebenfalls weit hinten; die Pannenstatistik 2026 nennt den '
        'Insignia als Schlusslicht der Mittelklasse. Auch frühere ADAC-Auswertungen sahen den Insignia A meist im '
        'Bereich „schlecht“.'),
    'ford-kuga': (2, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 hatten die Kuga-Jahrgänge 2015, 2016, 2018 und 2020 deutlich mehr Pannen als '
        'die meisten gleich alten Autos, 2021 zählt er sogar zu den fünf Prozent mit den meisten Pannen; die '
        'Pannenstatistik 2026 nennt den Kuga (Erstzulassung 2021) als Schlusslicht seiner Klasse. Ältere '
        'ADAC-Auswertungen sahen Kuga I und II noch im Mittelfeld.'),
    'ford-mondeo': (2, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte auch der Mondeo V mit Erstzulassung 2015 bis 2017 und 2020 deutlich mehr '
        'Pannen als die meisten gleich alten Autos, nur 2019 schnitt er besser ab. Beim Mondeo IV waren laut ADAC die '
        'Erstzulassungen 2007 bis 2011 „schlecht“ bis „sehr schlecht“ und 2012 bis 2014 „mittel“.'),
    'peugeot-308': (2, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte der 308 II mit Erstzulassung 2015 bis 2017 deutlich mehr Pannen als die '
        'meisten gleich alten Autos, 2018 und 2019 lag er im Mittelfeld. Der Vorgänger 308 I (2007–2013) zählt laut '
        'ADAC zu den unzuverlässigsten Autos überhaupt; zum 308 III gibt es noch keine Daten.'),
    'opel-mokka': (3, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte der Mokka B (Erstzulassung 2021 und 2022) weniger Pannen als die meisten '
        'gleich alten Autos, der Mokka X mit Erstzulassung 2018 und 2019 dagegen deutlich mehr. Frühere '
        'ADAC-Auswertungen sahen den Mokka A im Mittelfeld; im TÜV-Report schneidet er besser als der Durchschnitt ab.'),
    'ford-fiesta': (4, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte der Fiesta VIII mit Erstzulassung 2018 bis 2020 weniger Pannen als die '
        'meisten gleich alten Autos, 2021 und 2022 lag er im Mittelfeld. Den Fiesta VII sahen ältere '
        'ADAC-Auswertungen meist im Bereich „gut“ bis „mittel“; im TÜV-Report liegt er etwa im Durchschnitt.'),
    'peugeot-2008': (4, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte der 2008 II (Erstzulassung 2020 bis 2022) weniger Pannen als die meisten '
        'gleich alten Autos, ebenso der 2008 I in den meisten Jahrgängen ab 2015. Im TÜV-Report schneidet der 2008 I '
        'dagegen unterdurchschnittlich ab, vor allem wegen Ölverlust.'),
    'renault-clio': (3, [P25],
        'Laut ADAC liegt der Clio IV (2012–2020) überwiegend im Bereich „mittel“, die Erstzulassungen 2015 und 2016 '
        'sogar bei „schlecht“; im TÜV-Report schneidet er leicht unterdurchschnittlich ab. Für Clio V und Captur weist '
        'die Pannenstatistik 2025 gemeinsame Werte aus: Erstzulassung 2021 und 2022 mit weniger Pannen als die meisten '
        'gleich alten Autos.'),
    'mercedes-e-klasse': (4, [P25],
        'Laut ADAC-Pannenstatistik 2025 hatte die E-Klasse W213 mit Erstzulassung 2017 bis 2022 durchweg weniger Pannen '
        'als die meisten gleich alten Autos. Beim Vorgänger W212 liegen die Jahrgänge 2012 bis 2016 laut ADAC '
        'überwiegend im Mittelfeld, 2009 bis 2011 schnitt er schlecht ab; im TÜV-Report liegt der W212 über dem '
        'Durchschnitt.'),
    'bmw-5er': (5, [P25, P26],
        'Laut ADAC-Pannenstatistik 2025 gehört der 5er mit Erstzulassung 2015 bis 2022 fast durchweg zu den 15 Prozent '
        'der Autos mit den wenigsten Pannen, die Pannenstatistik 2026 zählt ihn zu den Besten der oberen '
        'Mittelklasse. Den F10 stuft der ADAC ab 2011 als gut ein, beim TÜV fallen vor allem Achsgelenke, Federn und '
        'Antriebswellenmanschetten auf.'),
}

repo = sys.argv[1]
for mid, (rating, sources, note) in UPDATES.items():
    path = f'{repo}/packages/catalog/data/models/{mid}.json'
    model = json.load(open(path, encoding='utf-8'))
    ratings = model['ratings']
    before = ratings['reliability']
    ratings['reliability'] = rating
    ratings['reliabilityNote'] = note
    urls = {s['url'] for s in ratings['reliabilitySources']}
    ratings['reliabilitySources'] += [s for s in sources if s['url'] not in urls]
    with open(path, 'w', encoding='utf-8') as out:
        json.dump(model, out, ensure_ascii=False, indent=2)
        out.write('\n')
    print(f'{mid}: {before} -> {rating}')
