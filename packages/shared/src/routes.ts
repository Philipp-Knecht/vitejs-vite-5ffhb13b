/**
 * Public page routes of the web app. The API server uses this list to return
 * correct HTTP status codes for client-side routes; the build prerenders the
 * static pages and lists the indexable ones in the sitemap.
 */
export interface StaticPage {
  path: string;
  /** Included in sitemap.xml and indexable by search engines. */
  indexable: boolean;
}

export const STATIC_PAGES: readonly StaticPage[] = [
  { path: '/', indexable: true },
  { path: '/gebrauchtwagen-kaufen', indexable: true },
  { path: '/gebrauchtwagen-checkliste', indexable: true },
  { path: '/auto-besichtigung-checkliste', indexable: true },
  { path: '/pro', indexable: true },
  { path: '/bot', indexable: false },
  { path: '/datenschutz', indexable: false },
  { path: '/impressum', indexable: false },
];

/** Client-rendered routes (not prerendered, never indexed). */
const DYNAMIC_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/analyse\/[0-9a-f-]{36}$/i,
  /^\/inseratstext$/,
  /^\/meine-angebote$/,
  /^\/vergleich$/,
  /^\/verlauf$/,
  /^\/anmelden$/,
  /^\/registrieren$/,
  /^\/konto$/,
  /^\/passwort-vergessen$/,
  /^\/passwort-zuruecksetzen$/,
];

export function isStaticPage(pathname: string): boolean {
  return STATIC_PAGES.some((page) => page.path === pathname);
}

export function isAppRoute(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return isStaticPage(normalized) || DYNAMIC_ROUTE_PATTERNS.some((pattern) => pattern.test(normalized));
}
