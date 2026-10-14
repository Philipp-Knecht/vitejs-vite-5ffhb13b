"""Adds 'frequent breakdown causes' from the ADAC Pannenstatistik 2025 to generations without researched issues.

Usage: python3 -I pannen_issues.py <repo> <defects.json> [--write] [model ids...]
Only generations without issues get one; a year shared with the previous generation counts for the older one.
"""
import json
import pathlib
import sys

P25 = {'label': 'ADAC Pannenstatistik 2025',
       'url': 'https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf'}
DEFAULT_TIP = ('Zu dieser Generation haben wir noch keine Schwachstellen ausgewertet. Lass das Auto vor dem Kauf in '
               'einer Werkstatt prüfen und Rückrufe per Fahrgestellnummer erfragen.')
PARTIAL_TIP = ('Weitere Schwachstellen dieser Generation haben wir noch nicht ausgewertet. Lass das Auto vor dem Kauf '
               'in einer Werkstatt prüfen und Rückrufe per Fahrgestellnummer erfragen.')

# Row names in the ADAC statistics; shared rows are noted in the text.
ROWS = {
    'vw-golf': 'VW Golf', 'vw-polo': 'VW Polo', 'vw-up': 'VW up!', 'skoda-citigo': 'Skoda Citigo',
    'seat-mii': 'SEAT Mii', 'vw-t-roc': 'VW T-Roc', 'vw-passat': 'VW Passat', 'vw-tiguan': 'VW Tiguan',
    'vw-touran': 'VW Touran', 'vw-caddy': 'VW Nutzfahrzeuge Caddy', 'vw-sharan': 'VW Sharan',
    'opel-corsa': 'Opel Corsa', 'opel-astra': 'Opel Astra', 'opel-insignia': 'Opel Insignia',
    'opel-mokka': 'Opel Mokka', 'opel-zafira': 'Opel Zafira', 'opel-meriva': 'Opel Meriva', 'opel-adam': 'Opel ADAM',
    'ford-fiesta': 'Ford Fiesta (Courier)', 'ford-focus': 'Ford Focus', 'ford-kuga': 'Ford Kuga',
    'ford-mondeo': 'Ford Mondeo', 'ford-c-max': 'Ford C-MAX', 'ford-s-max': 'Ford S-MAX',
    'peugeot-208': 'Peugeot 208', 'peugeot-308': 'Peugeot 308', 'peugeot-2008': 'Peugeot 2008',
    'renault-clio': 'Renault Clio/Captur', 'renault-captur': 'Renault Clio/Captur', 'renault-megane': 'Renault Mégane',
    'renault-twingo': 'Renault Twingo', 'renault-scenic': 'Renault Scénic', 'renault-kadjar': 'Renault Kadjar',
    'toyota-aygo': 'Toyota Aygo', 'toyota-yaris': 'Toyota Yaris', 'toyota-corolla': 'Toyota Corolla',
    'hyundai-i10': 'Hyundai i10', 'hyundai-i20': 'Hyundai i20', 'hyundai-i30': 'Hyundai i30',
    'hyundai-kona': 'Hyundai Kona', 'kia-picanto': 'Kia Picanto', 'kia-ceed': 'KIA Ceed/XCeed',
    'kia-sportage': 'Kia Sportage', 'bmw-1er': 'BMW 1er-Reihe', 'bmw-3er': 'BMW 3er-Reihe', 'bmw-5er': 'BMW 5er-Reihe',
    'bmw-2er-active-tourer': 'BMW 2er-Reihe (inkl. Grand- und Active-Tourer)', 'bmw-x1': 'BMW X1',
    'mercedes-a-klasse': 'Mercedes-Benz A-Klasse', 'mercedes-b-klasse': 'Mercedes-Benz B-Klasse',
    'mercedes-c-klasse': 'Mercedes-Benz C-Klasse', 'mercedes-e-klasse': 'Mercedes-Benz E-Klasse',
    'mercedes-cla': 'Mercedes-Benz CLA', 'skoda-fabia': 'Skoda Fabia', 'skoda-octavia': 'Skoda Octavia',
    'skoda-superb': 'Skoda Superb', 'skoda-kodiaq': 'Skoda Kodiaq', 'skoda-karoq': 'Skoda Karoq',
    'audi-a3': 'Audi A3', 'audi-a4': 'Audi A4', 'audi-a6': 'Audi A6', 'audi-q3': 'Audi Q3',
    'seat-ibiza': 'SEAT Ibiza', 'seat-leon': 'SEAT Leon', 'seat-alhambra': 'SEAT Alhambra',
    'dacia-sandero': 'Dacia Sandero', 'dacia-logan': 'Dacia Logan', 'dacia-duster': 'Dacia Duster',
    'fiat-500': 'Fiat 500', 'fiat-panda': 'Fiat Panda', 'fiat-tipo': 'Fiat Tipo', 'nissan-micra': 'Nissan Micra',
    'nissan-qashqai': 'Nissan Qashqai', 'mazda-3': 'Mazda 3', 'mazda-cx-5': 'Mazda CX-5', 'mazda-2': 'Mazda 2',
    'volvo-xc60': 'Volvo XC60', 'smart-fortwo': 'smart fortwo', 'suzuki-swift': 'Suzuki Swift',
    'mini-mini': 'MINI MINI', 'mitsubishi-space-star': 'Mitsubishi Space Star',
}
SHARED = {'Renault Clio/Captur': 'Clio und Captur wertet der ADAC gemeinsam aus.'}

# Lay names and what to check, per defect in the ADAC list.
DEFECTS = {
    'Starterbatterie': ('Starterbatterie', 'Alter der Batterie erfragen und sie testen lassen; springt der Motor zögerlich an, ist ein Tausch fällig.'),
    'Zündkerze': ('Zündkerzen', 'Nach dem letzten Zündkerzenwechsel fragen; ruckelt der Motor, Zündkerzen und Zündspulen prüfen lassen.'),
    'Zündspule': ('Zündspulen', 'Nach dem letzten Zündkerzenwechsel fragen; ruckelt der Motor, Zündkerzen und Zündspulen prüfen lassen.'),
    'Anlasser': ('Anlasser', 'Mehrmals starten: Der Motor muss ohne Zögern und ohne Klacken anspringen.'),
    'Generator': ('Lichtmaschine', 'Die Batterie-Ladekontrollleuchte muss nach dem Start ausgehen; die Ladespannung kann eine Werkstatt messen.'),
    'Kraftstoffpumpe': ('Kraftstoffpumpe', 'Springt der Motor schlecht an oder geht er aus, die Kraftstoffpumpe prüfen lassen und nach Reparaturen fragen.'),
    'Turbo-Lader': ('Turbolader', 'Auf der Probefahrt kräftig beschleunigen: Leistungsloch, Pfeifen oder die Motorkontrollleuchte deuten auf Probleme am Turbo hin.'),
    'Turbo-Lader Saug-, Druckleitung, Ladeluftkühler': ('Leitungen am Turbolader (mit Ladeluftkühler)', 'Auf der Probefahrt kräftig beschleunigen: Leistungsloch, Pfeifen oder die Motorkontrollleuchte deuten auf Probleme am Turbo hin.'),
    'Ladedruckregelung': ('Ladedruckregelung', 'Auf der Probefahrt kräftig beschleunigen: Leistungsloch, Pfeifen oder die Motorkontrollleuchte deuten auf Probleme am Turbo hin.'),
    'Kühlwasserpumpe': ('Wasserpumpe', 'Kühlmittelstand prüfen und unter dem Auto nach Flecken schauen; nach der Probefahrt muss die Temperaturanzeige im Normalbereich stehen.'),
    'Kühl-/Heizungsschlauch': ('Kühlschläuche', 'Kühlmittelstand prüfen und unter dem Auto nach Flecken schauen; nach der Probefahrt muss die Temperaturanzeige im Normalbereich stehen.'),
    'Motorkühlung allgemein': ('Motorkühlung', 'Kühlmittelstand prüfen und unter dem Auto nach Flecken schauen; nach der Probefahrt muss die Temperaturanzeige im Normalbereich stehen.'),
    'Thermostat': ('Thermostat', 'Kühlmittelstand prüfen und unter dem Auto nach Flecken schauen; nach der Probefahrt muss die Temperaturanzeige im Normalbereich stehen.'),
    'Bremsbelag': ('Bremsbeläge', 'Bremsen auf der Probefahrt testen und nach dem letzten Bremsenservice fragen.'),
    'Bremstrommel vorne/hinten': ('Bremstrommeln', 'Bremsen auf der Probefahrt testen und nach dem letzten Bremsenservice fragen.'),
    'Feststellbremse mechanisch': ('Handbremse', 'Die Handbremse muss das Auto am Hang sicher halten.'),
    'AdBlue': ('AdBlue-System', 'Nach Störungen am AdBlue-System fragen und auf Warnmeldungen im Display achten.'),
    'Partikelfilter': ('Partikelfilter', 'Fragen, ob das Auto viel Kurzstrecke fuhr und ob es Probleme mit dem Partikelfilter gab; Warnleuchte beachten.'),
    'Zündschloss': ('Zündschloss', 'Mit allen Schlüsseln starten: Der Motor muss jedes Mal anspringen.'),
    'Transponder': ('Schlüssel-Transponder', 'Mit allen Schlüsseln starten: Der Motor muss jedes Mal anspringen.'),
    'Wegfahrsperre': ('Wegfahrsperre', 'Mit allen Schlüsseln starten: Der Motor muss jedes Mal anspringen.'),
    'Öldruck': ('Öldruck', 'Ölstand prüfen und nach dem letzten Ölwechsel fragen; die Öldruck-Warnleuchte darf nach dem Start nicht leuchten.'),
    'Schaltgestänge': ('Schaltgestänge', 'Auf der Probefahrt alle Gänge durchschalten; hakelt die Schaltung, prüfen lassen.'),
    'Einspritzdüse/Injektor': ('Einspritzdüsen', 'Auf unruhigen Leerlauf, Ruckeln und Rauch aus dem Auspuff achten.'),
    'Fahrzeugelektrik allgemein': ('Bordelektrik', 'Alle elektrischen Funktionen ausprobieren, von Licht und Fensterhebern bis zum Infotainment.'),
    'Sicherungs- und Relaisbox': ('Sicherungs- und Relaiskasten', 'Alle elektrischen Funktionen ausprobieren, von Licht und Fensterhebern bis zum Infotainment.'),
    'Antriebsriemen': ('Keilrippenriemen', 'Nach dem letzten Riemenwechsel fragen; Quietschen beim Start deutet auf Verschleiß.'),
    'Zahnriemen': ('Zahnriemen', 'Nach dem letzten Zahnriemenwechsel fragen und ihn mit einer Rechnung belegen lassen.'),
    'Kupplung allgemein': ('Kupplung', 'Auf der Probefahrt auf eine rutschende oder ruckende Kupplung achten.'),
    'Abgasrückführung': ('Abgasrückführung', 'Auf Leistungsmangel und die Motorkontrollleuchte achten.'),
    'Motor allgemein': ('Motor', 'Den Motor vor dem Kauf in einer Werkstatt prüfen lassen.'),
}
MINOR = {'Starterbatterie', 'Zündkerze', 'Zündspule'}
# Generations where the statistics would only hit a model-change year.
SKIP = {'vw-touran-i'}


def years_text(years):
    years = sorted(years)
    parts, start = [], years[0]
    for prev, cur in zip(years, years[1:] + [None]):
        if cur != prev + 1:
            parts.append(str(start) if start == prev else f'{start}–{prev}')
            start = cur
    return ', '.join(parts)


def lay_join(names):
    return names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' und ' + names[-1]


def issue_for(row, defects, own_years):
    found = [(name, sorted(set(years) & own_years)) for name, years in defects]
    found = [(name, years) for name, years in found if years and name in DEFECTS]
    if not found:
        return None
    names = [DEFECTS[name][0] for name, _ in found]
    if len(found) == 1:
        affects = f'Erstzulassung {years_text(found[0][1])} (ADAC-Pannenstatistik 2025)'
    else:
        affects = 'Laut ADAC-Pannenstatistik 2025: ' + '; '.join(
            f'{DEFECTS[name][0]} bei Erstzulassung {years_text(years)}' for name, years in found)
    detail = (f'Probleme mit {lay_join(names)} waren bei diesen Jahrgängen überdurchschnittlich oft der Grund für '
              f'einen Einsatz der ADAC-Straßenwacht.')
    if any(name == 'Starterbatterie' for name, _ in found):
        detail += ' Eine schwache Starterbatterie ist bei allen Autos die häufigste Pannenursache, hier aber besonders oft.'
    if row in SHARED:
        detail += ' ' + SHARED[row]
    checks = []
    for name, _ in found:
        if DEFECTS[name][1] not in checks:
            checks.append(DEFECTS[name][1])
    return {
        'title': 'Überdurchschnittlich oft Pannen: ' + lay_join(names),
        'affects': affects,
        'detail': detail,
        'check': ' '.join(checks[:3]),
        'severity': 'gering' if all(name in MINOR for name, _ in found) else 'mittel',
        'sources': [P25],
    }


def main():
    repo, defects_path = pathlib.Path(sys.argv[1]), sys.argv[2]
    write = '--write' in sys.argv
    only = {a for a in sys.argv[3:] if not a.startswith('--')}
    defects = json.load(open(defects_path, encoding='utf-8'))
    for path in sorted((repo / 'packages/catalog/data/models').glob('*.json')):
        model = json.loads(path.read_text(encoding='utf-8'))
        if only and model['id'] not in only or model.get('twinOf'):
            continue
        row = ROWS.get(model['id'])
        if not row or row not in defects:
            continue
        changed = False
        generations = sorted(model['generations'], key=lambda g: g['years'][0])
        for index, generation in enumerate(generations):
            if generation['issues'] or generation['id'] in SKIP:
                continue
            start, end = generation['years'][0], generation['years'][1] or 2022
            previous_end = max((g['years'][1] or 9999 for g in generations[:index]), default=None)
            if previous_end is not None and previous_end >= start:
                start = previous_end + 1
            own = set(range(start, min(end, 2022) + 1))
            issue = issue_for(row, defects[row], own)
            if not issue:
                continue
            print(f"{model['id']} / {generation['id']}: [{issue['severity']}] {issue['title']} | {issue['affects']}")
            generation['issues'].append(issue)
            generation['tips'] = [PARTIAL_TIP if tip == DEFAULT_TIP else tip for tip in generation['tips']]
            if PARTIAL_TIP not in generation['tips']:
                generation['tips'].append(PARTIAL_TIP)
            changed = True
        if changed and write:
            path.write_text(json.dumps(model, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


main()
