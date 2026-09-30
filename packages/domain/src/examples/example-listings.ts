/**
 * DEVELOPMENT / DEMO DATA.
 *
 * A fictional listing used for the "Beispiel ausprobieren" button. It is not
 * a real offer, runs through the same parser and analysis as real input and
 * is always labelled as an example in the UI. It contains deliberate gaps
 * and one contradiction so that the analysis has something to show.
 */
export interface ExampleListing {
  id: string;
  label: string;
  text: string;
}

const AUDI_A7 = `Audi A7 Sportback 3.0 TFSI quattro S tronic
12.900 € VB
10115 Berlin - Mitte
28.09.2026

Details
Marke
Audi
Modell
A7
Kilometerstand
185.000 km
Fahrzeugzustand
Unbeschädigtes Fahrzeug
Erstzulassung
Mai 2012
Kraftstoffart
Benzin
Leistung
310 PS
Getriebe
Automatik
Fahrzeugtyp
Limousine
Anzahl Türen
4/5
HU bis
Juni 2027
Umweltplakette
4 (Grün)
Schadstoffklasse
Euro5
Außenfarbe
Schwarz
Material Innenausstattung
Vollleder

Ausstattung
Klimaautomatik
Navigationssystem
Sitzheizung
Einparkhilfe
Tempomat
Xenon-/LED-Scheinwerfer
Alufelgen
Bluetooth
Freisprecheinrichtung

Beschreibung
Verkaufe meinen Audi A7 Sportback 3.0 TFSI quattro. Das Fahrzeug läuft einwandfrei und wurde regelmäßig gewartet. Nichtraucherfahrzeug.

Vor zwei Jahren wurden die Bremsen vorne erneuert. Sommer- und Winterreifen auf Alufelgen sind dabei.

Kleine Kratzer an der hinteren Stoßstange, sonst guter Zustand. Laufleistung aktuell 158.000 km, der Wagen wird noch gefahren.

Probefahrt nach Absprache. Privatverkauf, daher keine Garantie und keine Rücknahme.

Privater Nutzer
Aktiv seit 14.03.2016
Anzeigen-ID
2912345678`;

export const EXAMPLE_LISTINGS: readonly ExampleListing[] = [
  { id: 'audi-a7', label: 'Audi A7 Sportback 3.0 TFSI quattro (fiktives Beispiel)', text: AUDI_A7 },
];

export const DEFAULT_EXAMPLE_ID = 'audi-a7';

export function getExampleListing(id: string = DEFAULT_EXAMPLE_ID): ExampleListing | null {
  return EXAMPLE_LISTINGS.find((example) => example.id === id) ?? null;
}
