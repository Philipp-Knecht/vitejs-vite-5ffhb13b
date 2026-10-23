# Anfrage an Bewertungsdienste (Preis-Check)

Der Preis-Check bewertet Angebotspreise bisher nur mit Inseraten, die bei KaufCheck geprüft wurden. Mit einem
Bewertungsdienst gäbe es auch für Autos einen üblichen Preis, die noch niemand bei KaufCheck geprüft hat. Die Schnittstelle dafür ist im Code
vorbereitet (`apps/api/src/infrastructure/valuation/types.ts`); es fehlt nur ein Vertrag und der Adapter für die
API des Anbieters.

## Anbieter

| Anbieter                              | Was die Seite des Anbieters sagt                                                                                                                                                                                                                                                     | Kontakt                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **AutoUncle**                         | Marktpreise aus aktuellen Inseraten (AutoScore), API für 14 Länder mit API-Schlüssel; die Preisbewertung läuft u. a. auf Facebook Marketplace ([autohaus.de](https://www.autohaus.de/nachrichten/autohandel/gebrauchtwagen-facebook-setzt-auf-preisbewertung-von-autouncle-2703908)) | [b2b.autouncle.com/automotive-api](https://b2b.autouncle.com/automotive-api)      |
| **J.D. Power / Autovista (Schwacke)** | APIs für Fahrzeugdaten und Bewertungen; die Seite blockt automatische Abrufe, Angaben zu Deutschland und Preisen bitte dort selbst prüfen                                                                                                                                            | [jdpower.com/business/autovista-api](https://jdpower.com/business/autovista-api/) |
| **DAT**                               | Gebrauchtwagenbewertung (SilverDAT); Konditionen nicht veröffentlicht, Anfrage über den Vertrieb                                                                                                                                                                                     | [dat.de](https://www.dat.de)                                                      |

Für Verbraucher-Apps passt AutoUncle am besten (Marktpreis aus Inseraten, wie der Preis-Check selbst). Preise
nennt keiner der drei öffentlich.

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
>    Testumgebung gibt,
> 5. ob wir aus Ihrem Wert eine Einordnung ableiten und anzeigen dürfen, etwa eine Preisstufe („fairer Preis“,
>    „hoher Preis“) und einen Rat („verhandeln“, „weitersuchen“).
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
