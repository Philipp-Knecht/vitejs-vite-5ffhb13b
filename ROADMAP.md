# KaufCheck – Fahrplan

Stand: 16.10.2026. Ziel: KaufCheck deckt den ganzen Weg eines Gebrauchtwagenkaufs ab – von der Planung über
Suche, Prüfung, Besichtigung, Kauf und Zulassung bis zu Wartung und Wiederverkauf. Grundlage sind die offenen
Punkte aus [TODO.md](TODO.md), die Roadmap im [README](README.md#roadmap) und ein Abgleich des Kaufablaufs mit
dem Code.

Reihenfolge: Zuerst kommt, was nur Code braucht und Pro wertvoller macht. Was von Dritten abhängt (Zustimmung
der Börsen, lizenzierte Daten), läuft parallel und blockiert nichts. Aufwand: **S** = 1–2 PRs, **M** = 3–5
PRs, **L** = mehrere Wochen.

## Erledigt

| #   | Feature                                                                                   | PR        |
| --- | ----------------------------------------------------------------------------------------- | --------- |
| 1.1 | Kfz-Steuer-Rechner (aus den Werten im Fahrzeugschein)                                     | #20       |
| 1.2 | Laufende Kosten überschlagen (eigene Werte, Steuer eingerechnet)                          | #20       |
| 2.1 | Rückruf-Check: FIN erfragen, Herstellerseiten und KBA verlinken                           | #17       |
| 2.2 | Kauf-Assistent: Checkliste bis Zulassung und „Nach dem Kauf“                              | #21       |
| 2.4 | PDF-Mappe für die Besichtigung (Pro)                                                      | #18       |
| 2.5 | Verhandlungshilfe (Pro)                                                                   | #22       |
| 3.1 | Mein Auto: Auto anlegen, HU-Termin mit Kalenderdatei, Schwachstellen                      | #23       |
| 1.3 | Typklasse: Erklärung und Link zur GDV-Abfrage                                             | #24       |
| 5.5 | PWA: installierbar, Prüfung für die Besichtigung offline                                  | #25       |
| 2.3 | Kaufvertrag für den Privatkauf als PDF (Pro)                                              | #28       |
| 3.5 | Auto privat verkaufen: Ratgeber, Inseratstext (Pro), Übergabe an den Vertrag              | #30       |
| 3.3 | Kostenbuch und Serviceheft (Pro): Kosten, Verbrauch, CSV, Serviceheft-PDF                 | #31       |
| 1.4 | Kosten pro Monat im Vergleich (Pro), Hinweis im Auto-Berater                              | #32       |
| 3.2 | Erinnerungen per E-Mail und Kalenderdatei: HU, Inspektion, Bremsflüssigkeit, Reifen (Pro) | #33       |
| 5.4 | Ratgeber (Teil 1): Auto ummelden, Rückrufe prüfen, Autokosten im Monat                    | #34       |
| 1.5 | Finanzierungsrechner (kostenlos) und Kreditkosten im Vergleich der Kosten pro Monat (Pro) | #35       |
| 5.3 | Affiliate-Link zum Vergleich von Kfz-Versicherungen in drei Ratgebern (ohne Pro)          | #37       |
| 5.2 | Eigene Anzeigen (Sponsoring) vom eigenen Server statt AdSense, ohne Drittanbieter         | dieser PR |

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
| 1.5 | Finanzierungsrechner aus eigenen Zahlen (Kreditbetrag, Zins, Laufzeit) in den Kosten pro Monat  | S       | Kostenlos / Pro im Vergleich | Wettbewerb W1; kein Kreditvergleich ohne § 34c-Prüfung (siehe 5.3)                |

## Etappe 2 – Kauf und Übergabe

| #    | Feature                                                                                                           | Aufwand | Plan            | Anmerkung                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ------- | --------------- | ----------------------------------------------------------------------------- |
| 2.1  | Rückruf-Check: Fahrgestellnummer erfragen, Frage an den Verkäufer, Links zu Hersteller-Rückrufseiten und KBA      | S       | Kostenlos       | kein automatischer Abruf ohne geprüfte Nutzungsbedingungen                    |
| 2.2  | Kauf-Assistent: Schritt-für-Schritt-Checkliste von Besichtigung bis Zulassung                                     | M       | Kostenlos       | baut auf Ratgeber und Checkliste auf, Fortschritt je gespeichertem Angebot    |
| 2.3  | Kaufvertrag-Generator (aus dem Inserat vorbefüllt, PDF)                                                           | M       | Pro             | ohne Anwalt, nach Recherche (Entscheidung vom 15.10.2026, siehe DECISIONS.md) |
| 2.4  | PDF-Export von Analyse und Checkliste                                                                             | S–M     | Pro             | zum Mitnehmen zur Besichtigung                                                |
| 2.5  | Verhandlungshilfe: Mängel aus der Besichtigung als Argumente                                                      | S       | Pro             | ohne Preisangaben, solange keine Marktdaten vorliegen                         |
| 2.6  | Preisänderung je gespeichertem Angebot: Preis bei jedem erneuten Einfügen festhalten und anzeigen                 | S       | Kostenlos       | Wettbewerb W2; nur Nutzereingaben, kein automatischer Abruf                   |
| 2.7  | Standzeit: „online seit“ aus dem eingefügten Text oder eigener Angabe, Hinweis in der Verhandlungshilfe           | S       | Kostenlos / Pro | Wettbewerb W3                                                                 |
| 2.8  | Angebot oder Vergleich teilen (nur lesbarer Link)                                                                 | S–M     | Kostenlos       | Wettbewerb W4; Datenschutz prüfen (keine Kontodaten im Link)                  |
| 2.9  | Betrugshinweise in der Prüfung (z. B. Vorkasse, Verkäufer im Ausland) und Link zur Meldefunktion des Marktplatzes | S       | Kostenlos       | Wettbewerb W5; zuerst prüfen, was die Prüfung schon abdeckt                   |
| 2.10 | Suche: Umkreis um PLZ und Länderseiten der Marktplätze als Deeplinks prüfen und ergänzen                          | S       | Kostenlos       | Wettbewerb W6; nur Deeplinks, keine Abrufe                                    |

## Etappe 3 – Nach dem Kauf: „Mein Auto“

| #       | Feature                                                                                                                                                                      | Aufwand | Plan                          | Anmerkung                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------- | ----------------------------------------------------------------- |
| 3.1     | Mein Auto: gekauftes Angebot übernehmen (Modell, Generation, Erstzulassung, Kilometerstand)                                                                                  | M       | Kostenlos (1) / Pro (mehrere) | neues Datenmodell + Migration                                     |
| 3.2     | Erinnerungen an HU, Inspektion, Reifenwechsel, Bremsflüssigkeit (E-Mail, `.ics`)                                                                                             | M       | Pro                           | ohne Anwalt, nach gründlicher Recherche (Entscheidung 15.10.2026) |
| 3.3     | Digitales Serviceheft und Kostenbuch (optional Belege)                                                                                                                       | M–L     | Pro                           | ohne Belege gebaut; Belege brauchen Speicher, Kosten und AVV      |
| ~~3.4~~ | ~~„Darauf solltest du bei deinem Auto achten“ (Schwachstellen nach Laufleistung)~~                                                                                           | –       | –                             | gestrichen (15.10.2026)                                           |
| 3.5     | Wiederverkauf: Inseratstext-Generator, Verkaufs-Checkliste, Ab-/Ummeldung                                                                                                    | M       | Pro                           | Regeln zuerst, KI optional                                        |
| 3.6     | Inserat übergeben: Links zu den Inserieren-Seiten der Marktplätze, Text zum Kopieren                                                                                         | S       | Pro                           | Wettbewerb W7; nur Deeplinks, kein Datenaustausch                 |
| 3.7     | Erinnerungen ausbauen: Inspektion nach km oder Intervall, Fortschreiben nach Kostenbuch-Eintrag, Vorlauf wählbar, Hinweis bei überfälligem Termin, Status auf der Auto-Karte | M       | Pro                           | aus dem Review von 3.2 (Vergleich mit Wartungs-Apps)              |
| 3.8     | Web-Push in der PWA für Erinnerungen                                                                                                                                         | M       | Pro                           | Wettbewerb W8; Einwilligung im Browser                            |

## Etappe 4 – Daten und Partner (abhängig von Dritten)

| #   | Feature                                                                           | Blocker                                                                | Nächster Schritt                              |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| 4.1 | Link-Abruf von Inseraten je Plattform                                             | schriftliche Zustimmung                                                | Betreiber verschickt die Anfragen             |
| 4.2 | Foto-Analyse (Pro) nutzbar                                                        | hängt an 4.1                                                           | –                                             |
| 4.3 | Echte Marktpreise / Preiseinschätzung                                             | lizenzierte Daten (z. B. DAT, Schwacke, Partner-API); Kosten unbekannt | Entscheidungsvorlage mit Anbietern und Kosten |
| 4.4 | Alerts für gespeicherte Suchen und Preisänderungen                                | lizenzierte Inseratsdaten                                              | wie 4.3                                       |
| 4.5 | Browser-Erweiterung: angesehenes Inserat übernehmen                               | Rechtsfrage, Store-Freigaben                                           | Entscheidung, ob gewollt                      |
| 4.6 | eBay Buy APIs                                                                     | eBay-Partner-Network-Freigabe                                          | später                                        |
| 4.7 | Marktwert des eigenen Autos (täglich), Preistrend je Modell, Wertverlust-Prognose | lizenzierte Daten wie 4.3                                              | Wettbewerb W9; nach 4.3                       |

## Etappe 5 – Reichweite und Einnahmen

| #   | Feature                                                                                                   | Aufwand       | Anmerkung                                                                  |
| --- | --------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------- |
| 5.1 | AdSense aktivieren                                                                                        | –             | Google-Prüfung, dann `ADSENSE_CLIENT`/`ADSENSE_SLOT`                       |
| 5.2 | Datenschutzfreundliches Werbenetz hinter `AdSlot`                                                         | M             | Alternative zu AdSense                                                     |
| 5.3 | Affiliate (Gebrauchtwagencheck, Versicherungs-/Kreditvergleich)                                           | S–M           | ohne Anwalt, nach gründlicher Recherche zu § 34d / § 34c GewO (15.10.2026) |
| 5.4 | SEO: weitere Ratgeber und interne Links (Teil 1 erledigt: Ummelden, Rückrufe, Autokosten; Verkauf in #30) | M             | passt zu Etappe 1–3                                                        |
| 5.5 | PWA (installierbar, Checkliste offline)                                                                   | S–M           | native App erst bei Bedarf                                                 |
| 5.6 | Übersichtsseiten aus dem Modellwissen („Gute Gebrauchte bis 10.000 €“, Familienauto, Stadtauto, Elektro)  | S–M           | Wettbewerb W10; ohne Inserate, mit Berater und Deeplinks                   |
| 5.7 | Weitere Ratgeber: Gewährleistung beim Händler, Unfallwagen, Import, Versicherung                          | S je Ratgeber | Wettbewerb W11; Teil von 5.4                                               |
| 5.8 | Partner für „Was ist mein Auto wert?“, Verkauf an Händler, Leasing                                        | S             | Wettbewerb W12; als Affiliate-Link nach 5.3                                |

## Etappe 6 – Weitere Kategorien

Verträge und Datenbank sind für weitere Kategorien vorbereitet. Der Betreiber hat weitere Kategorien am
15.10.2026 freigegeben; sie kommen nach Etappe 1–3. Naheliegend sind Motorräder, Wohnmobile/Wohnwagen und
Transporter (Wettbewerb W13).

## Wettbewerbsabgleich (16.10.2026)

Abgleich mit AutoUncle (deutscher App-Store-Text und autouncle.ch/llms.txt), 12Gebrauchtwagen.de, Automarkt.de und Das Parking – nur öffentliche Info-Seiten,
App-Store-Texte und Presseberichte, keine Such- oder Inseratsseiten. autouncle.de blockt direkte Abrufe. Die Kernfunktionen der Wettbewerber (Marktpreis-Bewertung,
Preisverlauf, Suchaufträge für neue Inserate) brauchen Marktplatz- oder lizenzierte Daten und bleiben in
Etappe 4 (4.3, 4.4, 4.7).

| #   | Funktion beim Wettbewerb                         | Quelle                                                                                                         |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| W1  | Finanzierung und Leasing                         | https://www.12gebrauchtwagen.de/                                                                               |
| W2  | Preisentwicklung je Inserat                      | https://apps.apple.com/de/app/autouncle-gebrauchtwagen/id533433816, https://www.dasparking.de/pro-bereich.html |
| W3  | Standzeit („Days on Market“)                     | https://autouncle.ch/llms.txt                                                                                  |
| W4  | Favoriten teilen                                 | https://apps.apple.com/de/app/autouncle-gebrauchtwagen/id533433816                                             |
| W5  | Inserat melden (Betrug, verkauft)                | https://www.dasparking.de/                                                                                     |
| W6  | Umkreissuche, EU-weite Suche                     | https://www.automarkt.de/, https://www.dasparking.de/uber-uns.html                                             |
| W7  | Inserieren über einen Partner-Marktplatz         | https://www.automarkt.de/gebrauchtwagen/auto-kostenlos-inserieren/, https://www.dasparking.de/pro-bereich.html |
| W8  | Push-Benachrichtigungen in der App               | https://apps.apple.com/de/app/autouncle-gebrauchtwagen/id533433816                                             |
| W9  | Marktwert, Preistrends je Modell                 | https://autouncle.ch/llms.txt, https://www.dasparking.de/uber-uns.html                                         |
| W10 | Übersichtsseiten nach Budget und Fahrzeugart     | https://www.12gebrauchtwagen.de/                                                                               |
| W11 | Ratgeber (Import, Gewährleistung, Unfallwagen …) | https://www.12gebrauchtwagen.de/ratgeber                                                                       |
| W12 | Autobewertung und Verkauf über Partner           | https://www.12gebrauchtwagen.de/autoverkauf, https://www.automarkt.de/                                         |
| W13 | Motorräder, Wohnmobile, Nutzfahrzeuge            | https://www.automarkt.de/                                                                                      |

## Querschnitt

- Rechtstexte: keine anwaltliche Prüfung; 2.3, 3.2 und 5.3 nach gründlicher Recherche (Entscheidungen vom
  15.10.2026).
- Jedes Feature: Tests (Unit, Integration, E2E, axe), Datenschutzerklärung und FAQ anpassen.
- Nutzung mit der vorhandenen First-Party-Analytik messen und danach priorisieren.

## Reihenfolge

0 → 2.1 + 2.4 → 1.1/1.2 → 2.2 → 3.1/3.2 → Rest; 0.3 läuft im Hintergrund mit. Neue Features gehen vor
mehr Modellwissen.
