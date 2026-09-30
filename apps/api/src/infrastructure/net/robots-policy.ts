import robotsParser from 'robots-parser';
import { safeFetch, SafeFetchError, type Resolver, type SafeFetcher } from './safe-fetch';

export type RobotsDecision = 'allowed' | 'disallowed' | 'unavailable';

interface CacheEntry {
  decide: (url: string) => RobotsDecision;
  expiresAt: number;
}

export interface RobotsPolicyOptions {
  userAgent: string;
  /** Product token matched against `User-agent:` groups, e.g. "KaufCheckBot". */
  agentToken: string;
  timeoutMs: number;
  resolver?: Resolver;
  now?: () => number;
  fetcher?: SafeFetcher;
}

const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 5 * 60 * 1000;

/**
 * robots.txt handling per RFC 9309:
 *  - 2xx with text/plain → rules apply,
 *  - 4xx (except 429) → no restrictions,
 *  - 5xx, 429, network errors or unexpected content (e.g. a block page) → treated as
 *    "complete disallow" until the next check.
 */
export class RobotsPolicy {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly options: RobotsPolicyOptions) {}

  async check(url: URL, signal?: AbortSignal): Promise<RobotsDecision> {
    const now = this.options.now?.() ?? Date.now();
    const origin = url.origin;
    const cached = this.cache.get(origin);
    if (cached && cached.expiresAt > now) return cached.decide(url.toString());

    const entry = await this.load(origin, now, signal);
    this.cache.set(origin, entry);
    return entry.decide(url.toString());
  }

  private async load(origin: string, now: number, signal?: AbortSignal): Promise<CacheEntry> {
    const robotsUrl = `${origin}/robots.txt`;
    const host = new URL(origin).hostname;
    try {
      const fetcher = this.options.fetcher ?? safeFetch;
      const response = await fetcher(robotsUrl, {
        allowedHosts: new Set([host]),
        userAgent: this.options.userAgent,
        timeoutMs: this.options.timeoutMs,
        maxBytes: 512 * 1024,
        contentTypes: ['text/plain'],
        signal,
        resolver: this.options.resolver,
      });
      if (response.status >= 200 && response.status < 300) {
        const robots = robotsParser(robotsUrl, response.body.toString('utf8'));
        const token = this.options.agentToken;
        return {
          expiresAt: now + SUCCESS_TTL_MS,
          decide: (target) =>
            robots.isAllowed(target, token) === false ? 'disallowed' : 'allowed',
        };
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { expiresAt: now + SUCCESS_TTL_MS, decide: () => 'allowed' };
      }
      return { expiresAt: now + FAILURE_TTL_MS, decide: () => 'unavailable' };
    } catch (error) {
      if (error instanceof SafeFetchError && error.kind === 'aborted') throw error;
      return { expiresAt: now + FAILURE_TTL_MS, decide: () => 'unavailable' };
    }
  }
}
