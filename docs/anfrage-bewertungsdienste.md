# Anfrage an Bewertungsdienste (Preis-Check)

Der Preis-Check bewertet Angebotspreise bisher nur mit Inseraten, die bei KaufCheck geprüft wurden. Mit einem
Bewertungsdienst gäbe es für fast jedes Auto sofort einen üblichen Preis. Die Schnittstelle dafür ist im Code
vorbereitet (`apps/api/src/infrastructure/valuation/types.ts`); es fehlt nur ein Vertrag und der Adapter für die
API des Anbieters.

## Anbieter

| Anbieter                              | Was er anbietet                                                                                                                                               | Kontakt                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **AutoUncle**                         | Marktpreis aus aktuellen Inseraten (Algorithmus AutoScore), API mit einem Schlüssel für alle Marken, 14 Länder; Preisbewertung u. a. auf Facebook Marketplace | [b2b.autouncle.com/automotive-api](https://b2b.autouncle.com/automotive-api)                         |
| **J.D. Power / Autovista (Schwacke)** | Bewertungs-API (AutovistaVALUATION), in Deutschland verfügbar; Preise nur auf Anfrage                                                                         | [jdpower.com/business/autovista-api](https://jdpower.com/business/autovista-api/) („Request a Demo“) |
| **DAT**                               | SilverDAT Valuate auf Basis von Markttransaktionen; Lizenz nach Nutzung und Branche, nur über den Vertrieb                                                    | Vertrieb über [dat.de](https://www.dat.de)                                                           |

Quellen: Produktseiten der Anbieter; zu AutoUncle auf Facebook Marketplace
[autohaus.de](https://www.autohaus.de/nachrichten/autohandel/gebrauchtwagen-facebook-setzt-auf-preisbewertung-von-autouncle-2703908).
Für Verbraucher-Apps passt AutoUncle am besten (Marktpreis aus Inseraten, wie der Preis-Check selbst); DAT und
Schwacke liefern Händlerwerte; Preise nennen alle drei nur auf Anfrage.

## E-Mail-Entwurf

Betreff: Anfrage API-Zugang Gebrauchtwagen-Bewertung für KaufCheck (kaufcheck-app.de)

> Sehr geehrte Damen und Herren,
>
> ich betreibe KaufCheck (https://kaufcheck-app.de), einen Dienst für private Gebrauchtwagenkäufer in
> Deutschland. Nutzer fügen ein Inserat ein und erhalten eine Prüfung mit Fragen an den Verkäufer, einer Checkliste
> für die Besichtigung und einer Einordnung des Preises.
>
> Für die Preiseinordnung möchten wir Ihre Bewertung per API nutzen. Je Prüfung würden wir übermitteln: Marke,
> Modell, Variante, Erstzulassung (Monat/Jahr), Kilometerstand, Kraftstoff und Leistung. Personenbezogene Daten
> übermitteln wir nicht. Angezeigt würde der übliche Marktpreis (gerne mit Spanne) mit Ihrem Namen als Quelle.
>
> Erwartetes Volumen: [ANZAHL] Bewertungen pro Monat zum Start.
>
> Bitte teilen Sie mir mit:
>
> 1. ob und zu welchen Konditionen (pro Abfrage oder pauschal) ein API-Zugang möglich ist,
> 2. ob wir den Wert Verbrauchern anzeigen und Ihren Namen als Quelle nennen dürfen,
> 3. ob und wie lange wir Ergebnisse zwischenspeichern dürfen,
> 4. welche Angaben Ihre API zur Fahrzeugbestimmung braucht (z. B. Ihre eigenen Typcodes) und ob es eine
>    Testumgebung gibt.
>
> Mit freundlichen Grüßen
>
> [NAME]
> KaufCheck · [ANSCHRIFT LAUT IMPRESSUM] · [E-MAIL]

## Nach einer Zusage

1. Vertrag und Nutzungsbedingungen prüfen (Anzeige an Verbraucher, Quellenangabe, Zwischenspeicher).
2. Adapter für die API schreiben, der `ValuationProvider` erfüllt, und im Container übergeben.
3. Den API-Schlüssel nur bei Render unter Environment eintragen, nie im Code.
4. Datenschutzerklärung ergänzen (Empfänger: der Bewertungsdienst, übermittelt werden nur Fahrzeugdaten).
