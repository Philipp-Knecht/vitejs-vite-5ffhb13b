/**
 * Where buyers check recalls. Only the manufacturers know whether a particular
 * car still has an open recall, so KaufCheck links to their official pages and
 * to the KBA database; it never queries them itself.
 */
export interface RecallCheck {
  /** Official page of the manufacturer or its German importer. */
  url: string;
  /** `vin`: the page checks a FIN; `info`: recall information without a general FIN check. */
  lookup: 'vin' | 'info';
}

/** Recall database of the Kraftfahrt-Bundesamt: recalls by make, model and year, not by FIN. */
export const KBA_RECALL_DATABASE_URL = 'https://www.kba-online.de/rrdb/buerger/';

/**
 * Keyed by make id (`src/makes.ts`); only pages that were checked by hand
 * (October 2026). Makes without a German page, or whose FIN check covers a
 * single campaign only (e.g. Takata airbags), have no entry: buyers are sent to
 * a workshop and the KBA database instead.
 */
const RECALL_CHECKS: Readonly<Record<string, RecallCheck>> = {
  vw: {
    url: 'https://www.volkswagen.de/de/besitzer-und-service/ueber-ihr-auto/kundeninformationen.html',
    lookup: 'info',
  },
  mercedes: {
    url: 'https://www.mercedes-benz.de/passengercars/services-accessories/total-recall.html',
    lookup: 'vin',
  },
  bmw: {
    url: 'https://www.bmw.de/de/topics/service-zubehoer/bmw-service/rueckrufe.html',
    lookup: 'vin',
  },
  audi: { url: 'https://www.audi.de/de/kundenservice/feldmassnahmen/', lookup: 'vin' },
  opel: {
    url: 'https://www.opel.de/tools/pruefung-deines-fahrzeugs-auf-rueckrufaktionen.html',
    lookup: 'vin',
  },
  ford: { url: 'https://www.ford.de/hilfe/r%C3%BCckrufe', lookup: 'vin' },
  skoda: { url: 'https://recall.skoda-auto.com/107/de-de', lookup: 'vin' },
  renault: { url: 'https://www.renault.de/rueckrufkampagnen.html', lookup: 'vin' },
  dacia: { url: 'https://www.dacia.de/rueckrufkampagnen.html', lookup: 'vin' },
  peugeot: {
    url: 'https://www.peugeot.de/tools/pruefung-ihres-fahrzeugs-auf-rueckrufaktionen.html',
    lookup: 'vin',
  },
  citroen: {
    url: 'https://www.citroen.de/wartung-services/rueckrufaktion-pruefung.html',
    lookup: 'vin',
  },
  toyota: {
    url: 'https://www.toyota.de/zubehoer-service/fahrzeuginformationen/rueckrufaktionen',
    lookup: 'vin',
  },
  // Kia Europe's check (Germany selectable); kia.com/de has no recall page.
  kia: {
    url: 'https://www.kia.com/eu/service/kia-overview/service-and-maintenance/kia-recalls/',
    lookup: 'vin',
  },
  nissan: {
    url: 'https://www.nissan.de/kunden/rueckruf-oder-serviceaktionen.html',
    lookup: 'info',
  },
  mazda: {
    url: 'https://www.mazda.de/mazda-besitzer/handbuecher-und-videoanleitungen/rueckrufe/',
    lookup: 'vin',
  },
  // The BMW Group's recall check, also embedded on bmw.de.
  mini: {
    url: 'https://vehiclerecall.bmwgroup.com/index.html?brand=mini&market=de&language=de',
    lookup: 'vin',
  },
  suzuki: { url: 'https://auto.suzuki.de/service/rueckrufaktionen', lookup: 'vin' },
  honda: { url: 'https://www.honda.de/cars/services/recalls-and-updates.html', lookup: 'vin' },
  tesla: { url: 'https://service.tesla.com/de-DE/vin-recall-search', lookup: 'vin' },
  ds: {
    url: 'https://www.dsautomobiles.de/mein-ds/ueberblick/rueckrufaktionen.html',
    lookup: 'vin',
  },
  lexus: {
    url: 'https://www.lexus.de/lexus-besitzer/service-wartung/fahrzeugrueckruf',
    lookup: 'vin',
  },
};

export function recallCheckFor(makeId: string | null | undefined): RecallCheck | null {
  return makeId ? (RECALL_CHECKS[makeId] ?? null) : null;
}

/** For the catalog test: every entry must belong to a make of the catalog. */
export const RECALL_CHECK_MAKE_IDS: readonly string[] = Object.keys(RECALL_CHECKS);
