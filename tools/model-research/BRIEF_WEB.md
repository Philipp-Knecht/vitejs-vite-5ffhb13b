# Auftrag: Modellwissen für jüngere Modelle (KaufCheck)

KaufCheck (https://kaufcheck-app.de) hilft Laien beim Gebrauchtwagenkauf. Für jedes Modell brauchen wir je Generation:
Stärken, bekannte Schwachstellen mit Quelle, empfehlenswerte und problematische Motoren sowie Besichtigungs-Tipps.
Die Texte erscheinen öffentlich. Falsche Behauptungen über Produkte sind rechtlich heikel: Genauigkeit geht vor
Vollständigkeit – lieber weniger, dafür belegt.

## Eingaben

- Je Modell ein Dossier mit Auszügen aus der ADAC-Pannenstatistik 2025:
  `tools/model-research/work/dossiers_web/<id>.txt`
  (Erklärung der Tabellenspalten steht oben in der Datei). Das ist die Quelle für die Zuverlässigkeit.
- Die Katalogdaten (id, make, model, segment, ggf. twinOf) stehen im Auftrag. Übernimm sie exakt.

## Recherche (sparsam)

Pro Modell höchstens 2 WebSearch und 3 WebFetch. Gute Quellen für Schwachstellen:

- AUTO BILD TÜV-Report-Artikel zum Modell (Suche z. B. „<Marke> <Modell> TÜV-Report Schwachstellen autobild“),
- ADAC (Autotest, Rückrufe, Pannenstatistik), auto motor und sport (Gebrauchtwagen-Check), Autozeitung,
- für Baujahre, Kraftstoffe, Getriebe: Wikipedia (de).
  Keine Inserats- oder Suchseiten von Marktplätzen (mobile.de, AutoScout24, Kleinanzeigen, eBay, Autohero, pkw.de, Facebook).
  Bei WebFetch immer eine Frage stellen, die nur die nötigen Fakten zurückgibt (Schwachstellen mit betroffenen Motoren
  und Baujahren, Rückrufe, Pannenschwerpunkte) – nicht den ganzen Artikel.

## Harte Regeln

1. Jede Schwachstelle braucht mindestens eine Quelle (Titel + URL), die du tatsächlich abgerufen hast und die die Aussage
   stützt. Keine erfundenen oder geratenen URLs. Unsicher → weglassen.
2. Betroffene Motoren/Baujahre so genau wie die Quelle („1.5 TSI, 2018–2019“), nicht verallgemeinern.
3. Generationen: eine je Baureihe ab etwa Baujahr 2010, Facelifts gehören dazu. id „<model-id>-<kurzname>“
   (a–z, 0–9, Bindestriche). years: [von, bis] bzw. bis = null, wenn laufend. Grunddaten der Baureihe (bodyTypes,
   fuels, seats, automatic) vollständig – aus Wikipedia oder gesichertem Allgemeinwissen. automatic: true, wenn ein
   Automatik- oder Doppelkupplungsgetriebe erhältlich war. typicalPriceEur und priceSource: null.
   - bodyTypes: limousine | schraegheck | kombi | suv | van | cabrio | coupe | pickup | bus
   - fuels: petrol | diesel | electric | hybrid | plugin_hybrid | lpg | cng
4. Schwachstellen 0–5 pro Generation. Wichtige Rückrufe (Bremsen, Lenkung, Airbags, Brandgefahr) zu EINER Schwachstelle
   „Rückrufe: …“ zusammenfassen (severity „mittel“, check „Per Fahrgestellnummer beim Händler prüfen lassen, ob die
   Rückrufe erledigt sind.“). severity: „hoch“ = Motor-/Getriebeschaden, Sicherheitsrisiko, sehr teuer; „mittel“ =
   häufige Pannenursache oder spürbare Kosten; „gering“ = lästig, günstig.
   Eine auffällige Pannenstatistik (z. B. hohe Pannenkennziffer bestimmter Jahrgänge) darf eine Schwachstelle sein,
   mit dem Dossier-PDF als Quelle („ADAC Pannenstatistik 2025“).
5. ratings (1–5, ganze Zahlen): reliability aus der Pannenstatistik im Dossier (deutlich unter dem Schnitt = 5 bzw. 4,
   Durchschnitt = 3, deutlich darüber = 2 bzw. 1) und ggf. dem TÜV-Report; reliabilityNote 1–2 Sätze mit Zahlen;
   reliabilitySources: Dossier-PDF (Label „ADAC Pannenstatistik 2025“) und ggf. weitere. Steht das Modell nicht in der
   Statistik: reliability nach TÜV-Report, sonst 3 mit der Notiz „Noch keine ausreichende Pannenstatistik.“
   runningCosts (5 = günstig), space, comfort: grobe Einschätzung nach Klasse und Quellen.
6. strengths 2–4, engines.recommended/caution nur mit Bezug auf eine Quelle (why: „laut AUTO BILD …“), sonst leer.
   tips 1–4 modellspezifisch. summary: ein Satz für Laien. aliases: Schreibweisen in Inseraten, kleingeschrieben.
7. Sprache: Deutsch, kurz, sachlich, für Laien verständlich; keine Werbung, kein Alarmismus.
8. Baugleiches Modell (twinOf im Auftrag): `"twinOf": "<id>"` setzen; Schwachstellen nur mit Quelle zu diesem oder dem
   baugleichen Modell (dann in affects „laut Quelle zum baugleichen …“).

## Format (ein JSON-Objekt je Modell)

```json
{
  "id": "skoda-karoq",
  "make": "Škoda",
  "model": "Karoq",
  "aliases": ["karoq"],
  "segment": "suv_kompakt",
  "summary": "…",
  "ratings": {
    "reliability": 4,
    "reliabilityNote": "…",
    "reliabilitySources": [
      { "label": "ADAC Pannenstatistik 2025", "url": "https://assets.adac.de/…pdf" }
    ],
    "runningCosts": 4,
    "space": 4,
    "comfort": 3
  },
  "generations": [
    {
      "id": "skoda-karoq-1",
      "name": "Karoq",
      "code": "NU",
      "years": [2017, null],
      "bodyTypes": ["suv"],
      "fuels": ["petrol", "diesel"],
      "seats": [5],
      "automatic": true,
      "typicalPriceEur": null,
      "priceSource": null,
      "strengths": ["…"],
      "issues": [
        {
          "title": "…",
          "affects": "…",
          "detail": "…",
          "check": "…",
          "severity": "mittel",
          "sources": [{ "label": "…", "url": "https://…" }]
        }
      ],
      "engines": { "recommended": [], "caution": [] },
      "tips": ["…"]
    }
  ]
}
```

## Arbeitsweise

- Lies nur diesen Auftrag und die Dossiers deiner Modelle; keine anderen Dateien, keine Skripte.
- Schreibe JEDES Modell sofort nach Fertigstellung mit dem Write-Tool in eine eigene Datei:
  `tools/model-research/work/models/<id>.json`
- Antworte am Ende nur in 2–4 Zeilen: fertige Modelle und Generationen ohne Schwachstellen.
