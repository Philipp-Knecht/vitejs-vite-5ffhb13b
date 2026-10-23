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

   **Werkzeuge und Ablauf:** [`tools/model-research/README.md`](tools/model-research/README.md) (Skripte,
   Recherche-Aufträge, Paketliste, ADAC-PDF-URLs, ausgewertete Pannenstatistik 2025). Kurz: Dossiers aus den
   ADAC-Gebrauchtwageninfos bauen → Recherche-Agent mit `BRIEF_ADAC.md` → `import_research.py` → Grunddaten von
   Hand prüfen → Zuverlässigkeit mit Pannenstatistik 2025/2026 abgleichen → `pannen_issues.py` →
   `npm run catalog:index`, Katalog-Tests, `check_sources.py`. Jede Schwachstelle nur mit Quelle; `make`,
   `model`, `segment` exakt wie im Katalog; Längenlimits aus `packages/catalog/src/types.ts` beachten.
   Erfahrungen: Recherche-Agenten waren bei Generations-Grunddaten zu zurückhaltend (Kraftstoffe/Automatik
   nachprüfen); bei Nutzungslimits brachen parallele Agenten ab → höchstens 2 parallel, je Modell eine Datei.
   Teilergebnisse der abgebrochenen Pakete A12/A13 wurden nie geprüft und sind nicht im Repository. Nicht
   gesichert sind das Hilfsskript für die Dossiers zu `BRIEF_WEB.md` und die PDF-Suche (siehe README dort).

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
8. **Bewertungsdienst anfragen (Betreiber).** Der Preis-Check bewertet nur mit Inseraten, die bei KaufCheck
   geprüft wurden, und braucht dafür mindestens 8 ähnliche. Ein Bewertungsdienst (AutoUncle, Autovista/Schwacke,
   DAT) liefert für fast jedes Auto einen Preis. Anbieter und E-Mail-Entwurf:
   [docs/anfrage-bewertungsdienste.md](docs/anfrage-bewertungsdienste.md). Nach einer Zusage: Adapter bauen
   (Code), Schlüssel nur bei Render eintragen.

## Priorität 3 – Weiterentwicklung (Code)

9. Auto-Berater mit mehr Modellen nachprüfen: Mit 43 Modellen fand das Profil „7 Sitze“ nur wenige Kandidaten
   (Caddy, Touran, Tiguan Allspace, 2er Gran Tourer); mit Sharan/Alhambra, Zafira, S-Max, Kodiaq, Berlingo usw.
   erneut prüfen und die Budget-Schätzung (`packages/catalog/src/advisor.ts`) bei Ausreißern nachkalibrieren.
10. Der vollständige Fahrplan mit allen fehlenden Features (Kosten, Kauf und Übergabe, „Mein Auto“, Daten und
    Partner, Reichweite) steht in [ROADMAP.md](ROADMAP.md). Ursprüngliche Roadmap aus dem README: weitere Kategorien (Verträge/DB reserviert), offizielle Datenquellen/Partner-APIs oder
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
