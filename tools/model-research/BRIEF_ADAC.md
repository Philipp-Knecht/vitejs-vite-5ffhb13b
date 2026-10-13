# Auftrag: Modellwissen aus ADAC-Gebrauchtwageninfos (KaufCheck)

KaufCheck (https://kaufcheck-app.de) hilft Laien beim Gebrauchtwagenkauf. Für jedes Modell brauchen wir
je Generation: Stärken, bekannte Schwachstellen mit Quelle, empfehlenswerte und problematische Motoren
sowie Besichtigungs-Tipps. Die Texte erscheinen öffentlich auf Modellseiten und im Auto-Berater.
Falsche Behauptungen über Produkte sind rechtlich heikel: Genauigkeit geht vor Vollständigkeit.

## Eingaben

- Je Modell ein Dossier: `tools/model-research/work/dossiers/<id>.txt`.
  Es enthält einen oder mehrere ADAC-Berichte „Gebrauchtwageninfo“; jeder beginnt mit `=== QUELLE: <PDF-URL>`.
  Der PDF-Text hat oft Leerzeichen mitten in Wörtern („Pan nen sta tis tik“) – lies darüber hinweg und schreibe selbst sauberes Deutsch.
  „ADAC-Einstufung je Erstzulassungsjahr“ ist von uns aus der Pannenstatistik des Berichts berechnet.
- Die Katalogdaten (id, make, model, segment, ggf. twinOf) stehen im Auftrag. Übernimm sie exakt.

## Harte Regeln

1. Jede Schwachstelle muss im Dossier stehen. Quelle ist die PDF-URL des Berichts, in dem sie steht, mit dem Label
   „ADAC Gebrauchtwageninfo: <Titel des Berichts>“, z. B. „ADAC Gebrauchtwageninfo: VW Golf VII (2012-2020) Benziner“.
   Nichts aus dem Gedächtnis ergänzen, keine anderen Quellen nennen, keine URLs verändern.
2. Keine Webrecherche. Einzige Ausnahme: Fehlt im Dossier eine heute verbreitete Generation (Baujahre ab 2010), darfst
   du pro Modell höchstens EINEN WebFetch auf den deutschen Wikipedia-Artikel machen, nur für Baujahre, Kraftstoffe,
   Karosserien und Sitzplätze. Diese Generation bekommt dann leere `issues` und `engines`, einen Tipp
   „Für diese Generation liegen noch wenige Gebrauchtwagen-Erfahrungen vor; Rückrufe per Fahrgestellnummer erfragen.“
3. Schwachstellen (2–6 pro Generation, nur für Käufer relevante):
   - aus „Häufige Bauteilfehler“ und den Aussagen zu Pannenstatistik und TÜV-Report;
   - Rückrufe: die wichtigsten sicherheitsrelevanten (Bremsen, Lenkung, Airbags, Brandgefahr, Achsen, Räder) zu EINER
     Schwachstelle „Rückrufe: …“ zusammenfassen (severity „mittel“, check „Per Fahrgestellnummer beim Händler prüfen
     lassen, ob die Rückrufe erledigt sind.“), affects mit Monat/Jahr der Rückrufe;
   - severity: „hoch“ = Motor- oder Getriebeschaden, Sicherheitsrisiko, sehr teure Reparatur; „mittel“ = häufige
     Pannenursache oder spürbare Kosten; „gering“ = lästig, günstig zu beheben;
   - affects: Motoren, Getriebe und Baujahre so genau, wie der Bericht sie nennt (nicht verallgemeinern);
   - detail: 1–2 Sätze, was passiert und was es bedeutet; check: was Käufer konkret prüfen oder fragen.
4. Generationen: eine je Baureihe. Benziner-, Diesel- und Alternativantrieb-Berichte derselben Baureihe zu EINER
   Generation zusammenführen (fuels entsprechend). Elektroversionen derselben Baureihe (z. B. e-Golf) gehören in diese
   Generation. Facelifts gehören zur Generation. Nur Generationen, die ab 2010 noch gebaut wurden.
   - id: „<model-id>-<kurzname>“ (nur a–z, 0–9, Bindestriche), z. B. „opel-astra-j“; name wie im Handel („Astra J“);
     code, falls im Bericht oder üblich, sonst null.
   - years: wie im Berichtstitel, laufend → null. seats: Sitzplätze laut Bericht (sonst übliche Werte der Baureihe).
   - automatic: true, wenn in der Baureihe ein Automatik- oder Doppelkupplungsgetriebe erhältlich war – auch wenn der
     Bericht es nicht erwähnt (Grunddaten der Baureihe dürfen aus gesichertem Allgemeinwissen oder dem einen
     Wikipedia-Abruf stammen; nur Schwachstellen brauchen die ADAC-Quelle). Im Zweifel true, wenn die Baureihe
     „Automatik“, „DSG“, „Steptronic“, „Tiptronic“, „EDC“, „EAT“ o. ä. anbot.
   - bodyTypes: limousine | schraegheck | kombi | suv | van | cabrio | coupe | pickup | bus
     (laut Berichtstext und Modellbezeichnungen, z. B. „Variant“/„Sports Tourer“/„Touring“ = Kombi).
   - fuels: petrol | diesel | electric | hybrid | plugin_hybrid | lpg | cng – alle Antriebe, die es in der Baureihe
     gab, auch wenn das Dossier nur den Benziner- oder nur den Diesel-Bericht enthält (Schwachstellen bleiben auf
     die Berichte beschränkt, affects nennt dann z. B. „laut ADAC-Bericht zu den Dieseln“).
   - typicalPriceEur und priceSource: immer null.
5. strengths: 2–4 Punkte aus der Plus-Liste des Berichts. engines.recommended / engines.caution: aus der „Empfehlung“
   und den Mängeln, why mit Bezug („laut ADAC …“). tips: 1–4 modellspezifische Besichtigungs-Tipps aus den Mängeln.
6. ratings (Modell, ganze Zahlen 1–5):
   - reliability aus der ADAC-Einstufung je Erstzulassungsjahr (überwiegend sehr gut = 5, gut = 4, mittel = 3,
     schlecht = 2, sehr schlecht = 1; die jüngste Generation zählt mehr) und den TÜV-Aussagen im Dossier;
     reliabilityNote: 1–2 Sätze mit dieser Begründung; reliabilitySources: die PDF-URLs dazu.
   - runningCosts (5 = günstig im Unterhalt), space, comfort: grobe Einschätzung aus Bericht und Fahrzeugklasse.
7. summary: ein Satz für Laien, wofür das Modell steht. aliases: Schreibweisen in Inseraten, kleingeschrieben.
8. Sprache: Deutsch, kurz, sachlich, für Laien verständlich; keine Werbung, kein Alarmismus
   („laut ADAC“, „häufig“, „Rückruf wegen …“).

## Format (JSON-Array, ein Objekt je Modell)

```json
[
  {
    "id": "opel-astra",
    "make": "Opel",
    "model": "Astra",
    "aliases": ["astra", "astra sports tourer", "astra gtc"],
    "segment": "kompakt",
    "summary": "…",
    "ratings": {
      "reliability": 3,
      "reliabilityNote": "…",
      "reliabilitySources": [
        {
          "label": "ADAC Gebrauchtwageninfo: Opel Astra J (2009-2015) Benziner",
          "url": "https://assets.adac.de/…pdf"
        }
      ],
      "runningCosts": 4,
      "space": 3,
      "comfort": 3
    },
    "generations": [
      {
        "id": "opel-astra-j",
        "name": "Astra J",
        "code": "J",
        "years": [2009, 2015],
        "bodyTypes": ["schraegheck", "kombi", "limousine"],
        "fuels": ["petrol", "diesel", "lpg"],
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
            "sources": [
              { "label": "ADAC Gebrauchtwageninfo: …", "url": "https://assets.adac.de/…pdf" }
            ]
          }
        ],
        "engines": { "recommended": [{ "name": "…", "why": "…" }], "caution": [] },
        "tips": ["…"]
      }
    ]
  }
]
```

Für ein baugleiches Modell (twinOf im Auftrag) zusätzlich `"twinOf": "<id>"` setzen.

## Arbeitsweise

- Lies nur diesen Auftrag und die Dossiers deiner Modelle (bei großen Dateien in Abschnitten). Keine anderen Dateien,
  keine Skripte, keine Prüfprogramme.
- Schreibe JEDES Modell sofort nach Fertigstellung mit dem Write-Tool in eine eigene Datei:
  `tools/model-research/work/models/<id>.json`
  (ein einzelnes JSON-Objekt im obigen Format, kein Array). Bereits geschriebene Modelle nicht noch einmal schreiben.
- Antworte am Ende nur in 2–4 Zeilen: fertige Modelle und Generationen ohne Schwachstellen.
