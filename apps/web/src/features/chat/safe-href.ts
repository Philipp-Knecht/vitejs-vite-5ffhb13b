import { isAppRoute } from '@kaufcheck/shared';

/**
 * A link of the assistant, if it leads to a page of KaufCheck. Anything else
 * (another site, a made-up path) is shown as plain text: links to other
 * sites only come in cards the server builds.
 */
export function safeHref(href: string): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  const path = href.split(/[?#]/)[0] ?? '';
  return isAppRoute(path) || /^\/modelle\/[a-z0-9-]+$/.test(path) ? href : null;
}
