# KaufCheck – Entscheidungen

Getroffene Architektur-, Technologie- und Produktentscheidungen mit Begründung. Quelle: Repository
(README, Code, Commit-Historie PR #1–#14) und der bisherige Entwicklungsverlauf. Wo eine Begründung oder
Alternative nicht überliefert ist, steht **(unbekannt)**.

## Grundsätze (Vorgaben des Betreibers, gelten weiter)

Diese Regeln hat der Betreiber ausdrücklich vorgegeben; sie sind im Code und in Tests verankert:

- Keine erfundenen Inseratsdaten, keine vorgetäuschten erfolgreichen API-Aufrufe, keine Schein-Funktionen nur für eine vollständige Optik.
- Kein aggressives Scraping, keine Umgehung von CAPTCHAs, Anti-Bot-Schutz oder Logins; AGB, robots.txt und Recht der Plattformen werden respektiert.
- Der URL-Abruf darf weder localhost, private IP-Bereiche, Cloud-Metadaten noch interne Dienste erreichen; kein offener Proxy.
- Keine API-Schlüssel, Geheimnisse, vollständigen privaten Inhalte oder unnötigen personenbezogenen Daten in Logs; keine fest einprogrammierten Schlüssel.
- KaufCheck gibt keine Kaufempfehlung und kein Gesamturteil über ein Auto.

## Architektur und Technik

| Entscheidung                                                                | Begründung                                                                                                                                                             | Verworfene Alternativen               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Monorepo** mit `shared` / `domain` / `catalog` / `api` / `web`            | Gemeinsame Zod-Verträge für Web und API; Geschäftslogik getrennt von UI und Infrastruktur                                                                              | (unbekannt)                           |
| **Regel-Engine first, KI optional**                                         | Analyse funktioniert ohne KI vollständig; KI ergänzt nur, wird per Zod validiert, Zitate müssen wörtlich im Inserat stehen, alles KI-Erzeugte heißt _Vermutung_ + _KI_ | Reine KI-Analyse (nicht nachprüfbar)  |
| **Server liefert Web-App aus, statische Seiten vorgerendert**               | Eine Origin (kein CORS), SEO ohne JavaScript, echte 404-Statuscodes                                                                                                    | (unbekannt)                           |
| **Prisma 7 + PostgreSQL**                                                   | Migrationen, Typsicherheit; Render bietet verwaltetes PostgreSQL                                                                                                       | (unbekannt)                           |
| **Render (Frankfurt) als Hosting**                                          | Blueprint aus `render.yaml`, Docker, EU-Region, ca. 13 $/Monat                                                                                                         | (unbekannt)                           |
| **Rate-Limit pro Client-Adresse aus `CF-Connecting-IP`**                    | Auf Render ist `X-Forwarded-For` fälschbar; ohne Header teilten sich alle Besucher ein Limit                                                                           | `X-Forwarded-For` / nur `TRUST_PROXY` |
| **Build-Dateien unter `/assets/` zählen nicht zum globalen Limit** (PR #14) | Jede Seite lädt mehrere Dateien; bei gemeinsam genutzten IP-Adressen (Firmen-NAT, Mobilfunk) kamen Seiten ohne CSS/JS an. Seiten und API bleiben begrenzt (300/min)    | –                                     |
| **Cookieless First-Party-Analytics**                                        | Nur Eventname, Zeit, wenige erlaubte Eigenschaften; keine IDs/IPs; DNT/GPC respektiert                                                                                 | Externe Analytics-Dienste             |
| **Sessions: Token nur als SHA-256 gespeichert, scrypt-Passwörter**          | Sicherheit                                                                                                                                                             | –                                     |

## Marktplätze und Suche

| Entscheidung                                                                                         | Begründung                                                                                                                                                                                                     | Verworfene Alternativen                                                           |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **„Auto finden“ verlinkt nur auf die Ergebnisseiten der Börsen** und lädt/zeigt deren Ergebnisse nie | Verlinken (auch Deep Links) ist zulässig (BGH „Paperboy“); eine Meta-Suche über fremde Datenbanken wäre Entnahme/Weiterverwendung (EuGH C-202/12 „Innoweb“) und ist laut AGB/robots.txt verboten               | Plattformübergreifende Ergebnisliste in KaufCheck (wurde evaluiert und verworfen) |
| **Link-Abruf von Inseraten in Produktion aus** (`LISTING_FETCH_MODE=off`)                            | AGB von Kleinanzeigen (§ 5), mobile.de (§ 11), AutoScout24 (§ 8.2), eBay, Autohero (§ 4), pkw.de (§ 12) und Meta verbieten automatisierten Zugriff ohne Zustimmung. Ein eingefügter Link führt zur Texteingabe | Abruf ohne Zustimmung                                                             |
| **Genehmigungsanfragen an Plattformen** per E-Mail (Entwürfe in der Betreiber-Anleitung)             | Weg zu legalem Link-Abruf                                                                                                                                                                                      | –                                                                                 |
| **heycar entfernt** (PR #10)                                                                         | heycar wurde 2025 eingestellt                                                                                                                                                                                  | –                                                                                 |
| **Alerts für gespeicherte Suchen nicht gebaut**                                                      | Bräuchten lizenzierte Inseratsdaten; KaufCheck fragt die Börsen nicht selbst ab                                                                                                                                | Eigene Abfrage der Börsen                                                         |

## Modellwissen und Auto-Berater

| Entscheidung                                                                                                                                                                      | Begründung                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ein JSON je Modell** in `packages/catalog/data/models`, lazy geladen (ein Chunk pro Modell), Kurzindex `data/index.json`                                                        | Kleine Bundles; Berater braucht nur die Kurzfassung. Tests erzwingen: Quelle je Schwachstelle, Marke/Segment wie im Katalog, Index aktuell                                   |
| **Jede Schwachstelle mit Quelle** (Titel + URL), Hinweis, dass nicht jedes Auto betroffen ist                                                                                     | Rechtliches Risiko falscher Produktaussagen; Genauigkeit vor Vollständigkeit                                                                                                 |
| **Hauptquelle: ADAC-Gebrauchtwageninfos (PDFs auf `assets.adac.de`)** statt freier Webrecherche                                                                                   | Viel billiger und belastbarer als Recherche je Modell; `assets.adac.de` hat keine robots.txt. Nie `/bff` oder `/suche/` auf adac.de abrufen (robots.txt)                     |
| **Zuverlässigkeitsnoten mit ADAC-Pannenstatistik 2025 (Werte je Erstzulassungsjahr) und 2026 (Beste/Schlusslichter je Klasse) abgeglichen**; die jüngste Generation zählt mehr    | Die Gebrauchtwageninfos decken oft nur ältere Generationen ab (Beispiel: Yaris IV fällt 2025/2026 durch Batteriepannen auf, alte Berichte sahen den Yaris gut)               |
| **Generationen ohne Auswertung**: neutraler Tipp, ggf. „Überdurchschnittlich oft Pannen: …“ aus dem Anhang der Pannenstatistik 2025                                               | Ehrlich statt leer; keine erfundenen Schwachstellen                                                                                                                          |
| **Berater erst ab 40 Modellen** (`ADVISOR_MIN_MODELS`)                                                                                                                            | Zu wenige Modelle ergeben schlechte Vorschläge                                                                                                                               |
| **Budget-Schätzung ohne echte Gebrauchtpreise** (`newestAffordableYear`: Klassen-Neupreis × Markenfaktor × Preisniveau je Baujahr × Wertverlust × Faktor für günstigere Angebote) | Es gibt keine lizenzierten Preisdaten; die UI kennzeichnet die Schätzung als grob. Kalibrierung: Golf 25k→2024, 15k→2020, 10k→2018, 5k→2012; Hochdachkombi-Neupreis 30.000 € |
| **Vergleich ohne Gesamtnote**: Reihenfolge nur aus den Prioritäten des Käufers (Gewichte 0/1/2), unbekannte Werte zählen als schlechtester                                        | Keine eigene Bewertung durch KaufCheck                                                                                                                                       |
| **Milde Hybride (48 V) werden als `hybrid` geführt**                                                                                                                              | Einheitlich über alle Modelle                                                                                                                                                |

## Pro, Recht, Werbung

| Entscheidung                                                                                                                                                                                                                          | Begründung                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Bestellablauf nach deutschem Verbraucherrecht (Button „Zahlungspflichtig bestellen“, Bestätigungs-E-Mails, Kündigungs- und Widerrufsbutton ohne Login), Texte in `packages/shared/src/legal`                                          | §§ 312f, 312i, 312j, 312k, 356a, 357a BGB; Seiten und E-Mails nutzen denselben Wortlaut |
| Server startet mit Stripe nur, wenn SMTP, `VAT_MODE` und vollständige Betreiberdaten (inkl. Telefon) gesetzt sind; Pro wird nur angeboten, wenn der Stripe-Preis gültig ist (monatlich, EUR, ohne Testphase, Steuer nicht „exklusiv“) | Pflichtangaben für Verträge; der angezeigte Preis muss der Endpreis sein                |
| Plan ändert sich nur durch signaturgeprüfte Stripe-Webhooks (jedes Event einmal)                                                                                                                                                      | Sicherheit                                                                              |
| Brevo statt Gmail für E-Mails                                                                                                                                                                                                         | Auftragsverarbeitungsvertrag in den Brevo-AGB                                           |
| AdSense nur mit Googles zertifiziertem Consent-Dialog, nie für Pro, nie bei DNT/GPC; CSP mit Nonce nur solange Werbung aktiv ist                                                                                                      | DSGVO/TTDSG; AdSense lehnt `onrender.com` ab, daher eigene Domain                       |

## Bekannte Einschränkungen

- Keine echten Marktpreise; Marktvergleich nur bei genug verifizierten Vergleichsinseraten. Die Budget-Schätzung des Beraters ist grob.
- Ohne Plattform-Zustimmung kein Link-Abruf → Nutzer müssen den Inseratstext einfügen; Foto-Analyse (Pro) ist dadurch praktisch nicht nutzbar.
- Nur die Kategorie Auto ist umgesetzt; weitere Kategorien sind in Verträgen/DB reserviert.
- Modellwissen deckt 53 von ~100–125 geplanten Modellreihen ab; einige Generationen haben keine Schwachstellen, nur Pannenschwerpunkte oder den neutralen Hinweis. Ältere Generationen vor ca. 2010 fehlen teils.
- Die Rechtstexte folgen Gesetz und amtlichen Mustern, sind aber nicht anwaltlich geprüft.
- Render deployt `main` automatisch; einmal (Commit `e483b69`) ist das Auto-Deploy ausgeblieben und musste manuell ausgelöst werden.
