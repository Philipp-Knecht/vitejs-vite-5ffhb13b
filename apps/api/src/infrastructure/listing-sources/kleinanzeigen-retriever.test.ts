import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors';
import { RobotsPolicy } from '../net/robots-policy';
import { SafeFetchError, type SafeFetcher, type SafeFetchResponse } from '../net/safe-fetch';
import {
  DisabledListingRetriever,
  FixtureListingRetriever,
  KleinanzeigenLiveRetriever,
  type LiveRetrieverOptions,
} from './kleinanzeigen-retriever';
import type { ListingUrl } from './types';

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/listings',
);
const fixture = (id: string) => readFileSync(path.join(FIXTURES, `${id}.html`), 'utf8');

const listingUrl = (id: string): ListingUrl => ({
  canonicalUrl: `https://www.kleinanzeigen.de/s-anzeige/auto/${id}-216-3331`,
  externalId: id,
  categoryId: '216',
});

const PERMISSIVE_ROBOTS = 'User-agent: *\nDisallow: /m-einloggen.html\n';

function reply(
  url: string,
  status: number,
  body: string,
  contentType = 'text/html',
): SafeFetchResponse {
  return { url, status, headers: {}, contentType, body: Buffer.from(body) };
}

/** Routes robots.txt and listing requests to the given handlers. */
function router(listing: (url: string) => Promise<SafeFetchResponse>, robots = PERMISSIVE_ROBOTS) {
  const fetcher = vi.fn<SafeFetcher>((url) =>
    url.endsWith('/robots.txt')
      ? Promise.resolve(reply(url, 200, robots, 'text/plain'))
      : listing(url),
  );
  return fetcher;
}

function retriever(fetcher: SafeFetcher, overrides: Partial<LiveRetrieverOptions> = {}) {
  const robots = new RobotsPolicy({
    userAgent: 'KaufCheckBot/1.0',
    agentToken: 'KaufCheckBot',
    timeoutMs: 1000,
    fetcher,
  });
  return new KleinanzeigenLiveRetriever({
    robots,
    userAgent: 'KaufCheckBot/1.0',
    timeoutMs: 1000,
    maxBytes: 3_000_000,
    ratePerMinute: 30,
    fetcher,
    now: () => new Date('2026-09-30T10:00:00Z'),
    ...overrides,
  });
}

async function appError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected an AppError');
}

const signal = () => new AbortController().signal;

describe('KleinanzeigenLiveRetriever', () => {
  it('retrieves and parses a permitted listing page', async () => {
    const fetcher = router((url) => Promise.resolve(reply(url, 200, fixture('2912345678'))));
    const result = await retriever(fetcher).retrieve(listingUrl('2912345678'), signal());
    expect(result.parsed.title).toContain('Audi A7');
    expect(result.source).toMatchObject({
      type: 'kleinanzeigen_url',
      url: listingUrl('2912345678').canonicalUrl,
      externalId: '2912345678',
      isExample: false,
      retrievedAt: '2026-09-30T10:00:00.000Z',
    });
    expect(result.urlCategoryId).toBe('216');
  });

  it('identifies itself with its own user agent and only fetches the listing host', async () => {
    const fetcher = router((url) => Promise.resolve(reply(url, 200, fixture('2912345678'))));
    await retriever(fetcher).retrieve(listingUrl('2912345678'), signal());
    const listingCall = fetcher.mock.calls.find(([url]) => !url.endsWith('/robots.txt'));
    expect(listingCall?.[1].userAgent).toBe('KaufCheckBot/1.0');
    expect([...(listingCall?.[1].allowedHosts ?? [])]).toEqual(['www.kleinanzeigen.de']);
  });

  it('caches successful retrievals briefly', async () => {
    const fetcher = router((url) => Promise.resolve(reply(url, 200, fixture('2912345678'))));
    const instance = retriever(fetcher);
    await instance.retrieve(listingUrl('2912345678'), signal());
    await instance.retrieve(listingUrl('2912345678'), signal());
    expect(fetcher.mock.calls.filter(([url]) => !url.endsWith('/robots.txt'))).toHaveLength(1);
  });

  it('respects robots.txt and never fetches disallowed pages', async () => {
    const fetcher = router(
      () => Promise.reject(new Error('must not be called')),
      'User-agent: *\nDisallow: /s-anzeige/\n',
    );
    const error = await appError(retriever(fetcher).retrieve(listingUrl('2912345678'), signal()));
    expect(error.code).toBe('SOURCE_NOT_PERMITTED');
    expect(error.details).toMatchObject({ fallbackToText: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('treats an unavailable robots.txt as "not permitted"', async () => {
    const fetcher = vi.fn<SafeFetcher>((url) => Promise.resolve(reply(url, 503, '', 'text/plain')));
    const error = await appError(retriever(fetcher).retrieve(listingUrl('2912345678'), signal()));
    expect(error.code).toBe('SOURCE_NOT_PERMITTED');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    [403, 'FETCH_BLOCKED'],
    [429, 'FETCH_BLOCKED'],
    [451, 'FETCH_BLOCKED'],
    [404, 'LISTING_NOT_FOUND'],
    [410, 'LISTING_NOT_FOUND'],
    [500, 'FETCH_FAILED'],
  ])('maps HTTP %i to %s with a text fallback and no retry', async (status, code) => {
    const fetcher = router((url) => Promise.resolve(reply(url, status, 'x')));
    const error = await appError(retriever(fetcher).retrieve(listingUrl('2912345678'), signal()));
    expect(error.code).toBe(code);
    expect(error.details).toMatchObject({ fallbackToText: true });
    expect(fetcher.mock.calls.filter(([url]) => !url.endsWith('/robots.txt'))).toHaveLength(1);
  });

  it('recognizes block pages and removed listings', async () => {
    const blocked = router((url) => Promise.resolve(reply(url, 200, fixture('2919999999'))));
    expect(
      (await appError(retriever(blocked).retrieve(listingUrl('2919999999'), signal()))).code,
    ).toBe('FETCH_BLOCKED');
    const removed = router((url) => Promise.resolve(reply(url, 200, fixture('2918888888'))));
    expect(
      (await appError(retriever(removed).retrieve(listingUrl('2918888888'), signal()))).code,
    ).toBe('LISTING_NOT_FOUND');
  });

  it('treats a redirect away from the listing as a removed listing', async () => {
    const fetcher = router(() =>
      Promise.resolve(
        reply('https://www.kleinanzeigen.de/s-autos/c216', 200, fixture('2912345678')),
      ),
    );
    expect(
      (await appError(retriever(fetcher).retrieve(listingUrl('2912345678'), signal()))).code,
    ).toBe('LISTING_NOT_FOUND');
  });

  it('rejects pages without listing content', async () => {
    const fetcher = router((url) =>
      Promise.resolve(reply(url, 200, '<html><body><p>Hallo</p></body></html>')),
    );
    expect(
      (await appError(retriever(fetcher).retrieve(listingUrl('2912345678'), signal()))).code,
    ).toBe('PARSING_FAILED');
  });

  it('maps transport failures and aborts', async () => {
    const network = router(() => Promise.reject(new SafeFetchError('timeout', 'slow')));
    expect(
      (await appError(retriever(network).retrieve(listingUrl('2912345678'), signal()))).code,
    ).toBe('FETCH_FAILED');
    const aborted = router(() => Promise.reject(new SafeFetchError('aborted', 'gone')));
    expect(
      (await appError(retriever(aborted).retrieve(listingUrl('2912345678'), signal()))).code,
    ).toBe('REQUEST_ABORTED');
  });

  it('limits outbound requests globally', async () => {
    const fetcher = router((url) => Promise.resolve(reply(url, 200, fixture('2912345678'))));
    const instance = retriever(fetcher, { ratePerMinute: 1 });
    await instance.retrieve(listingUrl('2912345678'), signal());
    const error = await appError(instance.retrieve(listingUrl('2911111111'), signal()));
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.details).toMatchObject({ fallbackToText: true, retryAfterSeconds: 60 });
  });
});

describe('FixtureListingRetriever (development only)', () => {
  const fixtures = new FixtureListingRetriever(FIXTURES, () => new Date('2026-09-30T10:00:00Z'));

  it('serves synthetic pages by ad id', async () => {
    const result = await fixtures.retrieve(listingUrl('2911111111'));
    expect(result.parsed.title).toContain('BMW');
  });

  it('fails like a real retrieval for unknown or invalid ids', async () => {
    expect((await appError(fixtures.retrieve(listingUrl('2900000000')))).code).toBe('FETCH_FAILED');
    expect((await appError(fixtures.retrieve(listingUrl('../../etc/passwd')))).code).toBe(
      'FETCH_FAILED',
    );
  });

  it('shows the block page behaviour for the blocked fixture', async () => {
    expect((await appError(fixtures.retrieve(listingUrl('2919999999')))).code).toBe(
      'FETCH_BLOCKED',
    );
  });
});

describe('DisabledListingRetriever', () => {
  it('always offers the text fallback', async () => {
    const error = await appError(new DisabledListingRetriever().retrieve());
    expect(error.code).toBe('SOURCE_NOT_PERMITTED');
    expect(error.details).toMatchObject({ fallbackToText: true });
  });
});
