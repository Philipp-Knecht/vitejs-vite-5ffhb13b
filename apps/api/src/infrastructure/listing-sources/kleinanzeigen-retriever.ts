import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyListingPage, hasListingContent, parseKleinanzeigenHtml } from '@kaufcheck/domain';
import { KLEINANZEIGEN_CANONICAL_HOST } from '@kaufcheck/shared';
import { AppError } from '../../lib/errors';
import { RateLimiter } from '../../lib/rate-limiter';
import { TtlCache } from '../../lib/ttl-cache';
import type { RobotsPolicy } from '../net/robots-policy';
import { safeFetch, SafeFetchError, type Resolver, type SafeFetcher } from '../net/safe-fetch';
import type { ListingUrl, ListingUrlRetriever, RetrievedListing } from './types';

const ALLOWED_HOSTS: ReadonlySet<string> = new Set([KLEINANZEIGEN_CANONICAL_HOST]);
const CACHE_TTL_MS = 10 * 60 * 1000;

function fallback(
  code:
    | 'SOURCE_NOT_PERMITTED'
    | 'FETCH_BLOCKED'
    | 'FETCH_FAILED'
    | 'LISTING_NOT_FOUND'
    | 'PARSING_FAILED',
  reason: string,
  cause?: unknown,
): AppError {
  return new AppError(code, { details: { fallbackToText: true }, internalReason: reason, cause });
}

function toRetrieved(html: string, url: ListingUrl, retrievedAt: Date): RetrievedListing {
  const classification = classifyListingPage(html);
  if (classification === 'blocked') throw fallback('FETCH_BLOCKED', 'block_page');
  if (classification === 'not_found') throw fallback('LISTING_NOT_FOUND', 'listing_removed');
  const parsed = parseKleinanzeigenHtml(html);
  if (classification === 'unknown' && !hasListingContent(parsed)) {
    throw fallback('PARSING_FAILED', 'no_listing_markers');
  }
  if (!parsed.title && !parsed.priceText && parsed.attributes.length === 0) {
    throw fallback('PARSING_FAILED', 'no_listing_content');
  }
  return {
    parsed,
    urlCategoryId: url.categoryId,
    source: {
      type: 'kleinanzeigen_url',
      url: url.canonicalUrl,
      externalId: parsed.externalId ?? url.externalId,
      retrievedAt: retrievedAt.toISOString(),
      isExample: false,
    },
  };
}

export interface LiveRetrieverOptions {
  robots: RobotsPolicy;
  userAgent: string;
  timeoutMs: number;
  maxBytes: number;
  ratePerMinute: number;
  resolver?: Resolver;
  now?: () => Date;
  fetcher?: SafeFetcher;
}

/**
 * Retrieves a single listing page where robots.txt permits it, identifying
 * itself honestly and never retrying around blocks or challenges. Results
 * are cached briefly and outbound requests are rate-limited globally so the
 * source is not burdened.
 */
export class KleinanzeigenLiveRetriever implements ListingUrlRetriever {
  readonly mode = 'live' as const;
  readonly platforms = ['kleinanzeigen'] as const;
  private readonly cache = new TtlCache<RetrievedListing>(CACHE_TTL_MS, 500);
  private readonly limiter: RateLimiter;

  constructor(private readonly options: LiveRetrieverOptions) {
    this.limiter = new RateLimiter(options.ratePerMinute, 60_000);
  }

  async retrieve(url: ListingUrl, signal: AbortSignal): Promise<RetrievedListing> {
    const cached = this.cache.get(url.canonicalUrl);
    if (cached) return cached;

    const decision = await this.options.robots
      .check(new URL(url.canonicalUrl), signal)
      .catch((error: unknown) => {
        throw error instanceof SafeFetchError && error.kind === 'aborted'
          ? new AppError('REQUEST_ABORTED')
          : fallback('FETCH_FAILED', 'robots_check_failed', error);
      });
    if (decision === 'disallowed') throw fallback('SOURCE_NOT_PERMITTED', 'robots_disallow');
    if (decision === 'unavailable') throw fallback('SOURCE_NOT_PERMITTED', 'robots_unavailable');

    if (!this.limiter.tryTake()) {
      throw new AppError('RATE_LIMITED', {
        message:
          'Gerade werden sehr viele Inserate geprüft. Bitte versuche es in einer Minute erneut oder füge den Inseratstext ein.',
        details: { fallbackToText: true, retryAfterSeconds: 60 },
        internalReason: 'outbound_rate_limit',
      });
    }

    let response;
    try {
      const fetcher = this.options.fetcher ?? safeFetch;
      response = await fetcher(url.canonicalUrl, {
        allowedHosts: ALLOWED_HOSTS,
        userAgent: this.options.userAgent,
        timeoutMs: this.options.timeoutMs,
        maxBytes: this.options.maxBytes,
        contentTypes: ['text/html', 'application/xhtml+xml'],
        signal,
        resolver: this.options.resolver,
      });
    } catch (error) {
      if (error instanceof SafeFetchError && error.kind === 'aborted')
        throw new AppError('REQUEST_ABORTED');
      throw fallback(
        'FETCH_FAILED',
        error instanceof SafeFetchError ? `fetch_${error.kind}` : 'fetch_error',
        error,
      );
    }

    if (response.status === 404 || response.status === 410)
      throw fallback('LISTING_NOT_FOUND', `status_${response.status}`);
    if (response.status === 403 || response.status === 429 || response.status === 451) {
      throw fallback('FETCH_BLOCKED', `status_${response.status}`);
    }
    if (response.status < 200 || response.status >= 300)
      throw fallback('FETCH_FAILED', `status_${response.status}`);
    // A redirect away from the listing (e.g. to search results) means the ad is gone.
    if (!new URL(response.url).pathname.startsWith('/s-anzeige/'))
      throw fallback('LISTING_NOT_FOUND', 'redirected_away');

    const retrieved = toRetrieved(
      response.body.toString('utf8'),
      url,
      this.options.now?.() ?? new Date(),
    );
    this.cache.set(url.canonicalUrl, retrieved);
    return retrieved;
  }
}

/**
 * DEVELOPMENT / TEST ONLY: serves synthetic listing pages from disk instead
 * of the network (`fixtures/listings/<ad id>.html`). Rejected in production
 * by the configuration.
 */
export class FixtureListingRetriever implements ListingUrlRetriever {
  readonly mode = 'fixtures' as const;
  readonly platforms = ['kleinanzeigen'] as const;

  constructor(
    private readonly directory: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async retrieve(url: ListingUrl): Promise<RetrievedListing> {
    if (!/^\d+$/.test(url.externalId)) throw fallback('FETCH_FAILED', 'invalid_fixture_id');
    let html: string;
    try {
      html = await readFile(path.join(this.directory, `${url.externalId}.html`), 'utf8');
    } catch (error) {
      throw fallback('FETCH_FAILED', 'fixture_missing', error);
    }
    return toRetrieved(html, url, this.now());
  }
}

/** Automatic retrieval disabled by configuration: always offer the text fallback. */
export class DisabledListingRetriever implements ListingUrlRetriever {
  readonly mode = 'off' as const;
  readonly platforms = [] as const;

  retrieve(): Promise<RetrievedListing> {
    return Promise.reject(fallback('SOURCE_NOT_PERMITTED', 'retrieval_disabled'));
  }
}
