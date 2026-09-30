import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AnalysisResult, ListingSource, NormalizedListing } from '@kaufcheck/shared';
import {
  parseKleinanzeigenHtml,
  parseListingText,
  prepareListing,
  VehicleAnalyzer,
  type MarketData,
} from '../src/index';

export const NOW = new Date('2026-09-30T10:00:00Z');

export const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

export function source(type: ListingSource['type'] = 'text'): ListingSource {
  return {
    type,
    url:
      type === 'kleinanzeigen_url'
        ? 'https://www.kleinanzeigen.de/s-anzeige/x/2911111111-216-1'
        : null,
    externalId: null,
    retrievedAt: NOW.toISOString(),
    isExample: type === 'example',
  };
}

export function listingFromText(
  text: string,
  type: ListingSource['type'] = 'text',
): NormalizedListing {
  const prepared = prepareListing({
    parsed: parseListingText(text),
    source: source(type),
    urlCategoryId: null,
  });
  if (!prepared.ok) throw new Error(`prepareListing failed: ${prepared.reason}`);
  return prepared.listing;
}

export function listingFromHtml(html: string): NormalizedListing {
  const prepared = prepareListing({
    parsed: parseKleinanzeigenHtml(html),
    source: source('kleinanzeigen_url'),
    urlCategoryId: '216',
  });
  if (!prepared.ok) throw new Error(`prepareListing failed: ${prepared.reason}`);
  return prepared.listing;
}

export function analyze(
  listing: NormalizedListing,
  market: MarketData | null = null,
): Promise<AnalysisResult> {
  return new VehicleAnalyzer().analyze(listing, { now: NOW, market });
}

/** Builds a minimal pasted listing from detail pairs and a description. */
export function pasted(
  details: Record<string, string>,
  description = '',
  title = 'Testauto',
): string {
  const lines = [title, '9.000 €', '10115 Berlin', 'Details'];
  for (const [label, value] of Object.entries(details)) lines.push(label, value);
  if (description) lines.push('Beschreibung', description);
  return lines.join('\n');
}
