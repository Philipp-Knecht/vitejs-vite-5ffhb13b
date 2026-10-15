# KaufCheck – Fahrplan

Stand: 15.10.2026. Ziel: KaufCheck deckt den ganzen Weg eines Gebrauchtwagenkaufs ab – von der Planung über
Suche, Prüfung, Besichtigung, Kauf und Zulassung bis zu Wartung und Wiederverkauf. Grundlage sind die offenen
Punkte aus [TODO.md](TODO.md), die Roadmap im [README](README.md#roadmap) und ein Abgleich des Kaufablaufs mit
dem Code.

Reihenfolge: Zuerst kommt, was nur Code braucht und Pro wertvoller macht. Was von Dritten abhängt (Zustimmung
der Börsen, lizenzierte Daten), läuft parallel und blockiert nichts. Aufwand: **S** = 1–2 PRs, **M** = 3–5
PRs, **L** = mehrere Wochen.

## Erledigt

| #   | Feature                                                              | PR        |
| --- | -------------------------------------------------------------------- | --------- |
| 1.1 | Kfz-Steuer-Rechner (aus den Werten im Fahrzeugschein)                | #20       |
| 1.2 | Laufende Kosten überschlagen (eigene Werte, Steuer eingerechnet)     | #20       |
| 2.1 | Rückruf-Check: FIN erfragen, Herstellerseiten und KBA verlinken      | #17       |
| 2.2 | Kauf-Assistent: Checkliste bis Zulassung und „Nach dem Kauf“         | #21       |
| 2.4 | PDF-Mappe für die Besichtigung (Pro)                                 | #18       |
| 2.5 | Verhandlungshilfe (Pro)                                              | #22       |
| 3.1 | Mein Auto: Auto anlegen, HU-Termin mit Kalenderdatei, Schwachstellen | dieser PR |

## Arbeitsweise je Feature

1. **Referenzen:** Wie lösen führende Plattformen dieses Feature (Funktionsumfang, Ablauf, Texte)? Nur
   öffentliche Seiten ansehen, nichts übernehmen, was urheberrechtlich geschützt ist. Gibt es keine Referenz,
   wird ohne gebaut.
2. **Bauen** in kleinen Schritten, passend zum bestehenden Code.
3. **Prüfschleife („Gauntlet“):** unabhängige Reviews (Fehler, Sicherheit, Barrierefreiheit, Texte,
   Abgleich mit den Referenzen) → Befunde beheben → erneut prüfen, bis eine Runde nichts mehr findet. Dazu
   `npm run check`, Integrations- und E2E-Tests.
4. **PR** gegen `main`, Merge nur nach Freigabe, danach Live-Prüfung.

## Etappe 0 – Laufendes abschließen

| #   | Aufgabe                                                                                    | Aufwand | Abhängigkeit   |
| --- | ------------------------------------------------------------------------------------------ | ------- | -------------- |
| 0.1 | PR #15 (10 Modelle, Übergabedoku, Recherche-Werkzeuge) mergen und live prüfen              | S       | Freigabe       |
| 0.2 | Stripe-Testkauf, Webhook bestätigen                                                        | –       | Betreiber      |
| 0.3 | Modellwissen: Pakete A12–A21 (48 Modelle), dann 38 jüngere Modelle → ~125 Modellreihen     | L       | läuft parallel |
| 0.4 | Auto-Berater mit mehr Modellen nachprüfen (Profil „7 Sitze“, Budget-Schätzung kalibrieren) | S       | nach A14–A16   |

## Etappe 1 – Kosten vor dem Kauf

| #   | Feature                                                                                         | Aufwand | Plan                         | Anmerkung                                                                         |
| --- | ----------------------------------------------------------------------------------------------- | ------- | ---------------------------- | --------------------------------------------------------------------------------- |
| 1.1 | Kfz-Steuer-Rechner je Generation/Motor                                                          | M       | Kostenlos                    | Formel aus dem Kraftfahrzeugsteuergesetz; Hubraum und CO₂ müssen ins Modellwissen |
| 1.2 | Unterhaltskosten-Rechner (Steuer, Kraftstoff/Strom nach eigener Fahrleistung, Wartungsrücklage) | M       | Kostenlos, Pro: im Vergleich | Rücklagen nur als einstellbare Annahme, keine erfundenen Werkstattpreise          |
| 1.3 | Versicherungs-Typklasse anzeigen                                                                | S–M     | Kostenlos                    | Datenquelle offen: Nutzungsrechte der GDV-Typklassen klären, sonst nur Link       |
| 1.4 | Kosten im Berater und im Vergleich („Gesamtkosten pro Monat“)                                   | M       | Pro                          | nach 1.1/1.2                                                                      |

## Etappe 2 – Kauf und Übergabe

| #   | Feature                                                                                                      | Aufwand | Plan      | Anmerkung                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------ | ------- | --------- | --------------------------------------------------------------------------------- |
| 2.1 | Rückruf-Check: Fahrgestellnummer erfragen, Frage an den Verkäufer, Links zu Hersteller-Rückrufseiten und KBA | S       | Kostenlos | kein automatischer Abruf ohne geprüfte Nutzungsbedingungen                        |
| 2.2 | Kauf-Assistent: Schritt-für-Schritt-Checkliste von Besichtigung bis Zulassung                                | M       | Kostenlos | baut auf Ratgeber und Checkliste auf, Fortschritt je gespeichertem Angebot        |
| 2.3 | Kaufvertrag-Generator (aus dem Inserat vorbefüllt, PDF)                                                      | M       | Pro       | **rechtlich heikel**: eigene, anwaltlich geprüfte Vorlage; erst nach Entscheidung |
| 2.4 | PDF-Export von Analyse und Checkliste                                                                        | S–M     | Pro       | zum Mitnehmen zur Besichtigung                                                    |
| 2.5 | Verhandlungshilfe: Mängel aus der Besichtigung als Argumente                                                 | S       | Pro       | ohne Preisangaben, solange keine Marktdaten vorliegen                             |

## Etappe 3 – Nach dem Kauf: „Mein Auto“

| #   | Feature                                                                                     | Aufwand | Plan                          | Anmerkung                                                        |
| --- | ------------------------------------------------------------------------------------------- | ------- | ----------------------------- | ---------------------------------------------------------------- |
| 3.1 | Mein Auto: gekauftes Angebot übernehmen (Modell, Generation, Erstzulassung, Kilometerstand) | M       | Kostenlos (1) / Pro (mehrere) | neues Datenmodell + Migration                                    |
| 3.2 | Erinnerungen an HU, Inspektion, Reifenwechsel, Bremsflüssigkeit (E-Mail, `.ics`)            | M       | Pro                           | Einwilligung, Abmeldelink, Datenschutzerklärung                  |
| 3.3 | Digitales Serviceheft und Kostenbuch (optional Belege)                                      | M–L     | Pro                           | Belege brauchen Speicher; Kosten und Auftragsverarbeitung klären |
| 3.4 | „Darauf solltest du bei deinem Auto achten“ (Schwachstellen nach Laufleistung)              | S       | Pro                           | nutzt vorhandenes Modellwissen                                   |
| 3.5 | Wiederverkauf: Inseratstext-Generator, Verkaufs-Checkliste, Ab-/Ummeldung                   | M       | Pro                           | Regeln zuerst, KI optional                                       |

## Etappe 4 – Daten und Partner (abhängig von Dritten)

| #   | Feature                                             | Blocker                                                                | Nächster Schritt                              |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| 4.1 | Link-Abruf von Inseraten je Plattform               | schriftliche Zustimmung                                                | Betreiber verschickt die Anfragen             |
| 4.2 | Foto-Analyse (Pro) nutzbar                          | hängt an 4.1                                                           | –                                             |
| 4.3 | Echte Marktpreise / Preiseinschätzung               | lizenzierte Daten (z. B. DAT, Schwacke, Partner-API); Kosten unbekannt | Entscheidungsvorlage mit Anbietern und Kosten |
| 4.4 | Alerts für gespeicherte Suchen und Preisänderungen  | lizenzierte Inseratsdaten                                              | wie 4.3                                       |
| 4.5 | Browser-Erweiterung: angesehenes Inserat übernehmen | Rechtsfrage, Store-Freigaben                                           | Entscheidung, ob gewollt                      |
| 4.6 | eBay Buy APIs                                       | eBay-Partner-Network-Freigabe                                          | später                                        |

## Etappe 5 – Reichweite und Einnahmen

| #   | Feature                                                                     | Aufwand | Anmerkung                                                                      |
| --- | --------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| 5.1 | AdSense aktivieren                                                          | –       | Google-Prüfung, dann `ADSENSE_CLIENT`/`ADSENSE_SLOT`                           |
| 5.2 | Datenschutzfreundliches Werbenetz hinter `AdSlot`                           | M       | Alternative zu AdSense                                                         |
| 5.3 | Affiliate (Gebrauchtwagencheck, Versicherungs-/Kreditvergleich)             | S–M     | **rechtlich heikel**: Erlaubnispflichten nach § 34d / § 34c GewO prüfen lassen |
| 5.4 | SEO: weitere Ratgeber (Kosten, Rückrufe, Zulassung, Verkauf), interne Links | M       | passt zu Etappe 1–3                                                            |
| 5.5 | PWA (installierbar, Checkliste offline)                                     | S–M     | native App erst bei Bedarf                                                     |

## Etappe 6 – Weitere Kategorien (offen)

Verträge und Datenbank sind für weitere Kategorien vorbereitet. Zurückgestellt, bis Etappe 1–3 stehen;
Entscheidung des Betreibers, ob KaufCheck beim Auto bleibt.

## Querschnitt

- Rechtstexte anwaltlich prüfen lassen, spätestens vor 2.3, 3.2 und 5.3.
- Jedes Feature: Tests (Unit, Integration, E2E, axe), Datenschutzerklärung und FAQ anpassen.
- Nutzung mit der vorhandenen First-Party-Analytik messen und danach priorisieren.

## Reihenfolge

0 → 2.1 + 2.4 → 1.1/1.2 → 2.2 → 3.1/3.2 → Rest; 0.3 läuft im Hintergrund mit. 2.3 und 5.3 erst nach
Entscheidung über eine anwaltliche Prüfung.
