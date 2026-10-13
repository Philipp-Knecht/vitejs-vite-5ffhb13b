# Recherche-Werkzeuge für das Modellwissen

Mit diesen Skripten und Aufträgen ist das Modellwissen in `packages/catalog/data/models` entstanden. Sie gehören
nicht zur Anwendung und laufen nur lokal. Voraussetzungen: Python 3 mit `pypdf` (`pip install pypdf`), `curl`,
Node.js (für `npx tsx`). Arbeitsdateien (PDFs, Dossiers, Ergebnisse der Recherche) liegen in `work/`; der Ordner
ist in `.gitignore` und wird nicht committet, weil er Auszüge aus urheberrechtlich geschützten ADAC-Berichten
enthält.

## Inhalt

| Datei                                                        | Zweck                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targets.json`                                               | 139 Recherche-Ziele (id, Marke, Modell, Segment) aus dem Katalog                                                                                                                                                           |
| `batches.json`                                               | Aufteilung in Pakete à 5 Modelle (A01–A21); A01–A11 sind erledigt, A12–A21 offen                                                                                                                                           |
| `urls_1.jsonl`, `urls_2.jsonl`                               | gefundene ADAC-„Gebrauchtwageninfo“-PDFs je Modell (`{"id", "urls"}`)                                                                                                                                                      |
| `build_dossiers.py`                                          | lädt diese PDFs nach `work/pdf/` und schreibt je Modell ein kompaktes Dossier nach `work/dossiers/<id>.txt` (inkl. berechneter ADAC-Einstufung je Erstzulassungsjahr, gekürzte Rückrufe)                                   |
| `BRIEF_ADAC.md`                                              | Auftrag an einen Recherche-Agenten: aus dem Dossier ein Modell-JSON schreiben (nur Quellen aus dem Dossier)                                                                                                                |
| `BRIEF_WEB.md`                                               | Auftrag für jüngere Modelle ohne Gebrauchtwageninfo (Pannenstatistik + wenige Webquellen)                                                                                                                                  |
| `import_research.py`                                         | übernimmt Agenten-Ergebnisse ins Repository, gleicht Marke/Modell/Segment mit dem Katalog ab, verwirft Schwachstellen ohne Quelle und Marktplatz-URLs, setzt den Standard-Tipp für ältere Generationen ohne Schwachstellen |
| `check_sources.py`                                           | prüft, ob alle Quell-URLs der Modell-JSONs erreichbar sind (Cache in `work/`)                                                                                                                                              |
| `pdfx.py`                                                    | gibt den Text eines PDFs aus, mit `layout` spaltengetreu                                                                                                                                                                   |
| `pannen2025.py`                                              | liest die Tabellen der ADAC-Pannenstatistik 2025 (Layout-Text) und stuft jeden Wert nach den ADAC-Grenzwerten ein (sehr gut … sehr schlecht)                                                                               |
| `pannen2025_defects.py`                                      | liest den Anhang „Überdurchschnittlich häufig auftretende Mängel nach Baureihe“                                                                                                                                            |
| `data/pannen2025_rows.jsonl`, `data/pannen2025_defects.json` | Ergebnis der beiden Parser (Zahlenwerte, kein Fließtext)                                                                                                                                                                   |
| `pannen_issues.py`                                           | ergänzt Generationen ohne Schwachstellen um „Überdurchschnittlich oft Pannen: …“ aus dem Anhang (Zuordnung Katalog-ID → Tabellenname in `ROWS`)                                                                            |
| `examples/reliability_*.py`                                  | **bereits angewendete** Anpassungen der Zuverlässigkeitsnoten je Paket – nur als Vorlage, nicht erneut ausführen                                                                                                           |
| `advisor-check.mjs`                                          | Plausibilitätsprüfung des Auto-Beraters für typische Käuferprofile                                                                                                                                                         |

## Ablauf je Paket

Alle Befehle aus dem Repository-Wurzelverzeichnis.

1. **Dossiers bauen** (nur für Modelle mit Einträgen in `urls_*.jsonl`):
   `python3 -I tools/model-research/build_dossiers.py dacia-sandero dacia-logan …`
   Fehlen PDFs für ein Modell, sie über eine Websuche nur auf `assets.adac.de` finden und in `urls_*.jsonl`
   ergänzen. Auf `www.adac.de` nie `/bff` oder `/suche/` abrufen (robots.txt). Marktplatzseiten nie abrufen.
2. **Recherche**: je Paket einen Agenten mit `BRIEF_ADAC.md` (bzw. `BRIEF_WEB.md`) beauftragen, z. B.
   „Lies zuerst den Auftrag tools/model-research/BRIEF_ADAC.md und halte dich strikt daran. Modelle
   (id | make | model | segment): - dacia-sandero | Dacia | Sandero | kleinwagen …“. Make/Modell/Segment
   stehen in `targets.json`. Baugleiche Modelle mit `twinOf: <id>` angeben. Höchstens zwei Agenten
   gleichzeitig; bei Nutzungslimits brechen sie sonst ab. Ergebnis: `work/models/<id>.json`.
3. **Übernehmen**: `python3 -I tools/model-research/import_research.py . tools/model-research/work/models/<id>.json …`
4. **Prüfen** (von Hand): Generationen, Baujahre, Kraftstoffe (milde Hybride als `hybrid`), Automatik, Sitze,
   Karosserien; Agenten waren hier oft zu zurückhaltend.
5. **Zuverlässigkeit abgleichen**: Werte aus `data/pannen2025_rows.jsonl` und die Listen „Die Besten / Die
   Schlechtesten in ihrer Klasse“ der
   [Pannenstatistik 2026](https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/)
   ansehen; die jüngste Generation zählt mehr. Note und `reliabilityNote` anpassen und beide Statistiken als
   Quelle eintragen (Vorlage: `examples/`). Formulierung für Werte der Pannenstatistik 2025: „weniger Pannen als
   die meisten gleich alten Autos“ (hellgrün), „unter den 15 Prozent mit den wenigsten Pannen“ (dunkelgrün),
   „Mittelfeld“ (gelb), „deutlich mehr Pannen als die meisten gleich alten Autos“ (orange), „zu den fünf Prozent
   mit den meisten Pannen“ (rot).
6. **Pannenschwerpunkte ergänzen**: `python3 -I tools/model-research/pannen_issues.py . tools/model-research/data/pannen2025_defects.json --write <ids…>`
   (ohne `--write` nur Vorschau).
7. **Abschließen**: Längenlimits aus `packages/catalog/src/types.ts` einhalten, dann
   `npm run catalog:index`, `npx vitest run --project catalog`,
   `python3 -I tools/model-research/check_sources.py . <ids…>` und `npx tsx tools/model-research/advisor-check.mjs`.

## Pannenstatistik neu einlesen

Das PDF der Pannenstatistik 2025 liegt unter
<https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf>.

```bash
mkdir -p tools/model-research/work
curl -sSL -o tools/model-research/work/pannen2025.pdf '<URL oben>'
python3 -I tools/model-research/pdfx.py tools/model-research/work/pannen2025.pdf layout > tools/model-research/work/pannen_layout.txt
python3 -I tools/model-research/pannen2025.py tools/model-research/work/pannen_layout.txt > tools/model-research/data/pannen2025_rows.jsonl
python3 -I tools/model-research/pannen2025_defects.py tools/model-research/work/pannen_layout.txt > tools/model-research/data/pannen2025_defects.json
```

Die Grenzwerte je Erstzulassungsjahr sind in `pannen2025.py` (`LIMITS`) fest eingetragen und gelten nur für die
Ausgabe 2025. Für eine neue Ausgabe müssen Spaltenjahre und Grenzwerte angepasst werden.

## Bekannte Lücken

- Die Dossiers für `BRIEF_WEB.md` (Auszüge aus der Pannenstatistik je Modell: Tabellenzeile, Klassentext,
  Mängel) wurden mit einem nicht gesicherten Hilfsskript erzeugt. Ersatz: die passenden Einträge aus
  `data/pannen2025_rows.jsonl` und `data/pannen2025_defects.json` plus den Klassenabschnitt aus dem
  Layout-Text in `work/dossiers_web/<id>.txt` zusammenstellen.
- Die PDF-Suche, aus der `urls_*.jsonl` entstanden ist, lief über Agenten mit Websuche (Domain
  `assets.adac.de`); dafür gibt es kein Skript.
