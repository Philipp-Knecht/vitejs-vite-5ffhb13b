/**
 * Classifies a retrieved HTML page before parsing. KaufCheck never tries to
 * get around a block or challenge page; such pages end the automatic
 * retrieval and the user is offered to paste the listing text instead.
 */
export type PageClassification = 'listing' | 'blocked' | 'not_found' | 'unknown';

const BLOCK_MARKERS: readonly RegExp[] = [
  /ip-bereich\s+(?:vor(?:&uuml;|ü)bergehend\s+)?gesperrt/i,
  /zugriff\s+(?:verweigert|gesperrt)/i,
  /access\s+denied/i,
  /captcha/i,
  /cf-challenge|challenge-platform|cf_chl_/i,
  /bitte\s+best(?:ä|&auml;)tige,?\s+dass\s+du\s+kein\s+roboter\s+bist/i,
  /are\s+you\s+a\s+robot/i,
  /unusual\s+traffic/i,
];

const NOT_FOUND_MARKERS: readonly RegExp[] = [
  /anzeige\s+(?:ist\s+)?nicht\s+mehr\s+verf(?:ü|&uuml;)gbar/i,
  /diese\s+anzeige\s+(?:wurde\s+)?(?:bereits\s+)?gel(?:ö|&ouml;)scht/i,
  /die\s+gew(?:ü|&uuml;)nschte\s+anzeige\s+(?:ist|existiert)\s+nicht/i,
  /seite\s+wurde\s+nicht\s+gefunden/i,
];

const LISTING_MARKERS: readonly RegExp[] = [
  /id=["']viewad-title["']/i,
  /id=["']viewad-price["']/i,
  /class=["'][^"']*addetailslist/i,
  /id=["']viewad-description/i,
  /property=["']og:type["'][^>]*content=["']product/i,
];

export function classifyListingPage(html: string): PageClassification {
  // Only inspect the beginning and the visible structure; pages are size-limited upstream.
  const sample = html.length > 400_000 ? html.slice(0, 400_000) : html;
  const looksLikeListing = LISTING_MARKERS.some((marker) => marker.test(sample));
  if (!looksLikeListing && BLOCK_MARKERS.some((marker) => marker.test(sample))) return 'blocked';
  if (NOT_FOUND_MARKERS.some((marker) => marker.test(sample))) {
    return looksLikeListing && /id=["']viewad-price["']/i.test(sample) ? 'listing' : 'not_found';
  }
  return looksLikeListing ? 'listing' : 'unknown';
}
