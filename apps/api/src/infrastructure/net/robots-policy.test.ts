import { describe, expect, it, vi } from 'vitest';
import { RobotsPolicy } from './robots-policy';
import { SafeFetchError, type SafeFetcher, type SafeFetchResponse } from './safe-fetch';

const LISTING = new URL('https://www.kleinanzeigen.de/s-anzeige/audi-a7/2912345678-216-3331');

function response(status: number, body = '', contentType = 'text/plain'): SafeFetchResponse {
  return { url: 'https://www.kleinanzeigen.de/robots.txt', status, headers: {}, contentType, body: Buffer.from(body) };
}

function policy(fetcher: SafeFetcher, now = () => 0) {
  return new RobotsPolicy({ userAgent: 'KaufCheckBot/1.0', agentToken: 'KaufCheckBot', timeoutMs: 1000, fetcher, now });
}

describe('RobotsPolicy', () => {
  it('applies the rules for our user agent', async () => {
    const rules = ['User-agent: *', 'Disallow: /s-suchanfrage.html', '', 'User-agent: KaufCheckBot', 'Disallow: /s-anzeige/'].join('\n');
    const robots = policy(() => Promise.resolve(response(200, rules)));
    expect(await robots.check(LISTING)).toBe('disallowed');
  });

  it('allows listing pages when only other paths are disallowed', async () => {
    const rules = ['User-agent: *', 'Disallow: /s-suchanfrage.html', 'Disallow: /m-einloggen.html'].join('\n');
    const robots = policy(() => Promise.resolve(response(200, rules)));
    expect(await robots.check(LISTING)).toBe('allowed');
    expect(await robots.check(new URL('https://www.kleinanzeigen.de/m-einloggen.html'))).toBe('disallowed');
  });

  it('treats 4xx as "no restrictions" and 5xx/429 as unavailable (RFC 9309)', async () => {
    expect(await policy(() => Promise.resolve(response(404))).check(LISTING)).toBe('allowed');
    expect(await policy(() => Promise.resolve(response(503))).check(LISTING)).toBe('unavailable');
    expect(await policy(() => Promise.resolve(response(429))).check(LISTING)).toBe('unavailable');
  });

  it('treats block pages and network errors as unavailable', async () => {
    const blockPage: SafeFetcher = () => Promise.reject(new SafeFetchError('bad_content_type', 'text/html'));
    const network: SafeFetcher = () => Promise.reject(new SafeFetchError('network', 'reset'));
    expect(await policy(blockPage).check(LISTING)).toBe('unavailable');
    expect(await policy(network).check(LISTING)).toBe('unavailable');
  });

  it('caches results and re-checks failures sooner', async () => {
    let clock = 0;
    const fetcher = vi.fn<SafeFetcher>(() => Promise.resolve(response(503)));
    const robots = policy(fetcher, () => clock);
    await robots.check(LISTING);
    await robots.check(LISTING);
    expect(fetcher).toHaveBeenCalledTimes(1);
    clock += 6 * 60 * 1000;
    await robots.check(LISTING);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
