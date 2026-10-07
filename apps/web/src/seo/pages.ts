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
    title: 'KaufCheck – Gebrauchtwagen finden und Inserate prüfen: mobile.de, AutoScout24 & Co.',
    description:
      'Eine Suche für mobile.de, AutoScout24, Kleinanzeigen & Co. und die Prüfung jedes Inserats: Angaben, Lücken, Widersprüche und passende Fragen an den Verkäufer.',
  },
  '/auto-finden': {
    title: 'Gebrauchtwagen suchen auf mobile.de, AutoScout24 & Co. – mit einer Suche | KaufCheck',
    description:
      'Wünsche einmal eingeben und die Treffer bei mobile.de, AutoScout24, Kleinanzeigen, eBay und weiteren Börsen öffnen – kostenlos und ohne Anmeldung.',
  },
  '/auto-berater': {
    title: 'Welches Auto passt zu mir? Der Auto-Berater für Gebrauchtwagen | KaufCheck',
    description:
      'Ein paar kurze Fragen zu Budget, Nutzung und Platz – KaufCheck zeigt passende Gebrauchtwagen mit Stärken und bekannten Schwachstellen und öffnet die Suche auf allen Börsen.',
  },
  '/modelle': {
    title: 'Gebrauchtwagen-Modelle: Schwachstellen, Motoren und Tipps | KaufCheck',
    description:
      'Beliebte Gebrauchtwagen im Überblick: bekannte Schwachstellen je Generation mit Quelle, empfehlenswerte Motoren und worauf du bei der Besichtigung achten musst.',
  },
  '/inserat-pruefen': {
    title: 'Gebrauchtwagen-Inserat prüfen: mobile.de, AutoScout24, Kleinanzeigen | KaufCheck',
    description:
      'Auto-Inserat einfügen: KaufCheck ordnet die Angaben, zeigt was fehlt und welche Widersprüche es gibt, und formuliert passende Fragen an den Verkäufer.',
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
    title: 'KaufCheck Pro – mehr Prüfungen, Verlauf und keine Werbung',
    description:
      'KaufCheck Pro: mehr Prüfungen pro Monat, Verlauf aller Analysen, größere Vergleiche und keine Werbung. Monatlich kündbar.',
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
  '/agb': {
    title: 'AGB für KaufCheck Pro | KaufCheck',
    description: 'Allgemeine Geschäftsbedingungen für das Abonnement KaufCheck Pro.',
    noindex: true,
  },
  '/widerrufsbelehrung': {
    title: 'Widerrufsbelehrung | KaufCheck',
    description: 'Widerrufsbelehrung und Muster-Widerrufsformular für KaufCheck Pro.',
    noindex: true,
  },
  '/vertrag-kuendigen': {
    title: 'Vertrag kündigen | KaufCheck',
    description: 'KaufCheck Pro kündigen – ohne Anmeldung, mit sofortiger Bestätigung.',
    noindex: true,
  },
  '/vertrag-widerrufen': {
    title: 'Vertrag widerrufen | KaufCheck',
    description: 'Den Vertrag über KaufCheck Pro online widerrufen.',
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
