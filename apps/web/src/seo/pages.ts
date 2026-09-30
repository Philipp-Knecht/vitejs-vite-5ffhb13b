export interface PageMeta {
  title: string;
  description: string;
  /** Keep out of search results (private or purely technical pages). */
  noindex?: boolean;
}

export const SITE_NAME = 'KaufCheck';

/** Metadata of the prerendered pages. Used by the prerender script and on client-side navigation. */
export const STATIC_PAGE_META: Readonly<Record<string, PageMeta>> = {
  '/': {
    title: 'KaufCheck – Gebrauchtwagen-Angebote prüfen',
    description:
      'Kleinanzeigen-Angebot einfügen und wichtige Informationen, fehlende Angaben und Fragen für den Verkäufer strukturiert prüfen.',
  },
  '/gebrauchtwagen-kaufen': {
    title: 'Gebrauchtwagen privat kaufen: Schritt für Schritt | KaufCheck',
    description:
      'Vom Budget über das Inserat bis zum Kaufvertrag: So kaufst du einen Gebrauchtwagen von privat, erkennst typische Betrugsmaschen und vermeidest teure Fehler.',
  },
  '/gebrauchtwagen-checkliste': {
    title: 'Gebrauchtwagen-Checkliste zum Abhaken | KaufCheck',
    description:
      'Die Checkliste für den Gebrauchtwagenkauf: Unterlagen, Karosserie, Technik, Innenraum, Probefahrt und Kaufvertrag – kompakt zum Durchgehen und Ausdrucken.',
  },
  '/auto-besichtigung-checkliste': {
    title: 'Auto-Besichtigung: Checkliste für Prüfung und Probefahrt | KaufCheck',
    description:
      'So besichtigst du einen Gebrauchtwagen richtig: was du mitnimmst, worauf du bei Lack, Rost, Motor und Reifen achtest und wie eine aussagekräftige Probefahrt abläuft.',
  },
  '/pro': {
    title: 'KaufCheck Pro – mehr Prüfungen, Verlauf und Fotoanalyse',
    description:
      'KaufCheck Pro: mehr Prüfungen pro Monat, Verlauf aller Analysen, größere Vergleiche, Fotoanalyse und keine Werbung.',
  },
  '/bot': {
    title: 'KaufCheckBot – Informationen für Websitebetreiber | KaufCheck',
    description:
      'Wie der KaufCheckBot Inserate abruft, robots.txt beachtet und wie du uns erreichst.',
    noindex: true,
  },
  '/datenschutz': {
    title: 'Datenschutzerklärung | KaufCheck',
    description: 'Welche Daten KaufCheck verarbeitet, wofür und wie lange.',
    noindex: true,
  },
  '/impressum': {
    title: 'Impressum | KaufCheck',
    description: 'Anbieterkennzeichnung von KaufCheck.',
    noindex: true,
  },
};

export const NOT_FOUND_META: PageMeta = {
  title: 'Seite nicht gefunden | KaufCheck',
  description: 'Diese Seite gibt es nicht.',
  noindex: true,
};

export function appPageMeta(title: string): PageMeta {
  return {
    title: `${title} | ${SITE_NAME}`,
    description: STATIC_PAGE_META['/']?.description ?? '',
    noindex: true,
  };
}
