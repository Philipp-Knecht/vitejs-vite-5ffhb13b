# KaufCheck – Offene Aufgaben

Stand: 13.10.2026. Nach Priorität sortiert. **(Betreiber)** = muss der Betreiber selbst erledigen (Konten,
Behörden, Dashboards); **(Code)** = Entwicklungsarbeit.

## Priorität 1 – zeitnah

1. **Stripe-Testkauf durchführen und Webhook bestätigen (Betreiber).** `billing: true` ist live (4,99 €/Monat).
   Ob Webhook-Ziel und `STRIPE_WEBHOOK_SECRET` stimmen, zeigt erst ein echter Kauf:
   /pro → bestellen → zahlen → zwei E-Mails (Eingangs- und Vertragsbestätigung), Konto wird Pro, in Stripe
   unter Entwickler → Webhooks Status 200. Danach Widerruf testen und in Stripe erstatten. Bei Fehlern
   in den Render-Logs nach `invalid_signature` suchen.
2. **10 neue Modelle in `main` bringen (Code).** Commit `bd7ff04` auf `claude/kaufcheck-complete-app-6yabal`
   (Kia Picanto/Rio/Ceed/Sportage, Audi A3/A4/A6/Q3, Seat Ibiza/Leon) ist geprüft, aber noch ohne PR.
   PR erstellen, CI abwarten, mergen, live prüfen (`/modelle/kia-ceed` liefert bis dahin 404).
3. **Modellwissen weiter ausbauen (Code), Ziel ~100–125 Modellreihen.** Offene Pakete
   (Katalog-IDs aus `packages/catalog/src/models.ts`):
   - A12: dacia-sandero, dacia-logan, dacia-duster, fiat-500, fiat-panda
   - A13: fiat-punto, fiat-tipo, nissan-micra, nissan-juke, nissan-leaf
   - A14: skoda-yeti, bmw-x1, bmw-x3, vw-id-3, vw-sharan
   - A15: seat-alhambra (baugleich vw-sharan), vw-multivan, citroen-c3, citroen-c4, citroen-berlingo
   - A16: ford-ka, ford-c-max, ford-s-max, opel-zafira, opel-meriva
   - A17: audi-a5, renault-zoe, renault-scenic, renault-kadjar, mazda-3
   - A18: mazda-cx-5, mazda-2, mazda-6, mazda-mx-5, volvo-xc60
   - A19: smart-fortwo, suzuki-swift, tesla-model-3, tesla-model-y, hyundai-kona
   - A20: honda-jazz, honda-civic, suzuki-vitara, vw-id-4, audi-q7
   - A21: bmw-x5, mercedes-cla, opel-adam
   - Jüngere Modelle ohne ADAC-Gebrauchtwageninfo (nur Pannenstatistik + Webquellen): audi-a1, audi-q2, audi-q5,
     citroen-c4-picasso, cupra-formentor, dacia-jogger, dacia-spring, ford-puma, hyundai-ioniq, hyundai-tucson,
     kia-niro, mazda-cx-30, mercedes-gla, mercedes-glc, mini-cooper, mini-countryman, mitsubishi-asx,
     nissan-qashqai, opel-combo (baugleich Berlingo), opel-crossland, opel-grandland, peugeot-108 (baugleich
     toyota-aygo), peugeot-3008, peugeot-rifter (baugleich Berlingo), seat-arona, seat-ateca, skoda-enyaq,
     skoda-kamiq, skoda-karoq, skoda-kodiaq, skoda-scala, toyota-c-hr, toyota-prius, toyota-rav4, volvo-v40,
     volvo-v60, volvo-xc40, vw-t-cross. (Prüfen, ob die ID jeweils im Katalog existiert.)

   **Wichtig:** Die bisherige Recherche-Werkzeugkette lag nur im temporären Arbeitsverzeichnis der alten
   Claude-Sitzung und ist **nicht im Repository** (Skripte `import_research.py`, `check_sources.py`,
   `pannen2025.py`, `pannen2025_defects.py`, `pannen_issues.py`, Aufträge `BRIEF_ADAC.md`/`BRIEF_WEB.md`,
   Dossiers aus den ADAC-PDFs). Sie muss bei Bedarf neu aufgebaut werden. Bewährter Ablauf:
   1. ADAC-„Gebrauchtwageninfo“-PDF(s) des Modells auf `assets.adac.de` finden (Websuche auf diese Domain),
      Text extrahieren (z. B. pypdf).
   2. JSON nach dem Format in `packages/catalog/data/models/README.md` erstellen. Regeln: jede Schwachstelle nur
      mit Quelle aus dem Bericht; `make`, `model`, `segment` exakt wie im Katalog; eine Generation je Baureihe
      ab ca. 2010, Facelifts gehören dazu; Grunddaten (Kraftstoffe, Automatik, Sitze, Karosserien) vollständig,
      milde Hybride als `hybrid`; `typicalPriceEur`/`priceSource` = `null`; Rückrufe zu einer Schwachstelle
      „Rückrufe: …“ zusammenfassen; Generationen ohne Bericht bekommen leere `issues` und den Tipp
      „Zu dieser Generation haben wir noch keine Schwachstellen ausgewertet. Lass das Auto vor dem Kauf in einer
      Werkstatt prüfen und Rückrufe per Fahrgestellnummer erfragen.“
   3. Zuverlässigkeitsnote (1–5) mit der ADAC-Pannenstatistik 2025 (PDF,
      `https://assets.adac.de/image/upload/v1776261444/ADAC-eV/KOR/Text/PDF/Pannenstatistik_2025_Bericht_czmf9q.pdf`,
      Grenzwerte je Erstzulassungsjahr auf S. „Farbschema“) und der Seite
      `https://www.adac.de/rund-ums-fahrzeug/unfall-schaden-panne/adac-pannenstatistik-2026/` (Beste/Schlusslichter je
      Klasse) abgleichen; jüngste Generation zählt mehr. Für Generationen ohne Schwachstellen ggf. die
      „überdurchschnittlich häufigen Mängel“ aus dem Anhang der Pannenstatistik 2025 als eine Schwachstelle
      „Überdurchschnittlich oft Pannen: …“ eintragen (Jahr der Modellwechsel zählt zur älteren Generation).
   4. Längenlimits des Schemas beachten (`packages/catalog/src/types.ts`, z. B. `affects` ≤ 240 Zeichen).
   5. `npm run catalog:index`, `npx vitest run --project catalog`, alle Quell-URLs auf Erreichbarkeit prüfen.
      Erfahrungen: Recherche-Agenten waren bei Generations-Grunddaten zu zurückhaltend (fehlende Kraftstoffe/Automatik
      nachprüfen); bei Nutzungslimits brachen parallele Agenten ab → höchstens 2 parallel, je Modell eine Datei.
      Teilergebnisse der abgebrochenen Pakete A12/A13 wurden nie geprüft und sind nicht im Repository.

## Priorität 2 – Betrieb und Recht

4. **Genehmigungsanfragen an Plattformen (Betreiber).** E-Mail-Entwürfe an mobile.de, AutoScout24, Autohero und
   pkw.de stehen in der Betreiber-Anleitung (Claude-Docs-Dokument im alten Account). Ob sie verschickt wurden und
   ob es Antworten gibt: (unbekannt). Erst mit schriftlicher Zustimmung darf `LISTING_FETCH_MODE=live` für die
   jeweilige Plattform aktiviert werden. Kleinanzeigen: Abruf bleibt aus (AGB § 5).
5. **AdSense-Prüfung für `kaufcheck-app.de` (Betreiber).** Status (unbekannt). Danach `ADSENSE_CLIENT` und
   `ADSENSE_SLOT` in Render setzen.
6. **Rechtstexte prüfen lassen (Betreiber).** Datenschutzerklärung, AGB, Widerrufsbelehrung sind nach Gesetz und
   Mustern erstellt, aber nicht anwaltlich geprüft. Gewerbe- und Finanzamt-Anmeldung waren Voraussetzung für Pro;
   Status (unbekannt).
7. **Betreiber-Anleitung sichern (Betreiber).** Das Claude-Docs-Dokument ist an den alten Account gebunden; bei
   Bedarf exportieren.

## Priorität 3 – Weiterentwicklung (Code)

8. Auto-Berater mit mehr Modellen nachprüfen: Mit 43 Modellen fand das Profil „7 Sitze“ nur wenige Kandidaten
   (Caddy, Touran, Tiguan Allspace, 2er Gran Tourer); mit Sharan/Alhambra, Zafira, S-Max, Kodiaq, Berlingo usw.
   erneut prüfen und die Budget-Schätzung (`packages/catalog/src/advisor.ts`) bei Ausreißern nachkalibrieren.
9. Roadmap aus dem README: weitere Kategorien (Verträge/DB reserviert), offizielle Datenquellen/Partner-APIs oder
   Browser-Erweiterung statt Seitenabruf, Marktvergleich mit mehr verifizierten Vergleichsdaten, Alerts für
   gespeicherte Suchen und Preisänderungen (brauchen lizenzierte Daten), PDF-Export von Analyse und Checkliste,
   datenschutzfreundliches Werbenetz hinter der `AdSlot`-Abstraktion.

## Unvollständige Funktionen

- **Foto-Analyse (Pro):** funktioniert nur mit abgerufenen Inseraten; der Abruf ist in Produktion aus → praktisch nicht nutzbar.
- **Link-Abruf:** technisch fertig (SSRF-sicher, robots.txt), rechtlich nicht freigegeben.
- **Werbung:** eingebaut, aber ohne AdSense-Freigabe inaktiv.
- **Modellwissen:** 53 von ~100–125 Modellreihen; einige Generationen nur mit Pannenschwerpunkten oder ohne Schwachstellen.
- **Marktvergleich:** erscheint nur bei genügend verifizierten Vergleichsinseraten.

## Bekannte Bugs

Derzeit ist **kein offener Bug** bekannt. Bereits gelöste Probleme (nicht erneut bearbeiten):

| Problem                                                                                                | Ursache / Lösung                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seiten ohne CSS/JS bei vielen Anfragen von einer Adresse (E2E-Test „check tab … keyboard“ schlug fehl) | Globales Rate-Limit zählte `/assets/`; behoben in PR #14 (`allowList` in `apps/api/src/app.ts`, Test in `apps/api/test/public-site.test.ts`). Erfolglos war zuvor ein Retry/`toPass` im E2E-Test – Ursache war nicht das Hydrieren. |
| Pro blieb „bald verfügbar“ trotz Stripe-Werten                                                         | Preis-ID in Render war falsch abgetippt (großes I statt kleinem l). Log: „could not load the Stripe price … No such price“. Gelöst durch Kopieren der ID. Fehlersuche steht in der Betreiber-Anleitung.                             |
| E2E-Tests nutzten veralteten API-Stand                                                                 | Vor `npx playwright test` `npm run build -w @kaufcheck/api` ausführen (oder `npm run test:e2e`, das baut).                                                                                                                          |
| Render deployte einen Merge nicht automatisch (`e483b69`)                                              | Manuell deployt; Ursache (unbekannt).                                                                                                                                                                                               |
| Berater schlug für 15.000 € einen aktuellen VW Caddy V vor                                             | Neupreis Hochdachkombi 27.000 → 30.000 € (PR #14).                                                                                                                                                                                  |
| Budget-Schätzung zu optimistisch (z. B. BMW 1er F70 für 20.000 €)                                      | Neu kalibriert (Commit „Advisor: calibrate the budget estimate…“, in PR #14).                                                                                                                                                       |

## Hinweise für die lokale Entwicklung

- PostgreSQL muss laufen (in der Cloud-Umgebung ggf. `service postgresql start`).
- `tsx` mit Top-Level-`await` in Skripten: als `.ts`-Datei ausführen.
- Prisma 7: Migrations-Diff gegen frische DB mit `prisma migrate diff --from-config-datasource --to-schema … --exit-code` prüfen.
- Nach Änderungen an `packages/catalog/data/models/*.json` immer `npm run catalog:index` (formatiert auch mit Prettier).
