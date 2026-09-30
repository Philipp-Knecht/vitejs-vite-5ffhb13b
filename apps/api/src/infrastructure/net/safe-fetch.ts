import dns from 'node:dns';
import type { LookupAddress } from 'node:dns';
import https from 'node:https';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { LookupFunction } from 'node:net';
import zlib from 'node:zlib';
import { isPublicAddress } from './ip-policy';

/**
 * Minimal HTTPS GET client that cannot be turned into an open proxy:
 *  - only `https:` URLs on an explicit host allowlist (no credentials, no custom ports),
 *  - every resolved address must be public; the connection is pinned to the
 *    vetted address, so DNS rebinding between check and connect is impossible,
 *  - redirects are followed manually and re-validated (max 3),
 *  - one overall deadline, an optional caller AbortSignal, a byte limit on the
 *    decompressed body and a content-type allowlist.
 */

export type SafeFetchErrorKind =
  | 'invalid_url'
  | 'host_not_allowed'
  | 'private_address'
  | 'dns_failed'
  | 'timeout'
  | 'aborted'
  | 'too_large'
  | 'too_many_redirects'
  | 'bad_content_type'
  | 'network';

export class SafeFetchError extends Error {
  constructor(
    readonly kind: SafeFetchErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SafeFetchError';
  }
}

export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

export interface SafeFetchOptions {
  allowedHosts: ReadonlySet<string>;
  userAgent: string;
  timeoutMs: number;
  maxBytes: number;
  /** Accepted media types, e.g. `['text/html']`. */
  contentTypes: readonly string[];
  /** Overrides the Accept header (defaults to the content types). */
  accept?: string;
  maxRedirects?: number;
  signal?: AbortSignal;
  resolver?: Resolver;
  /**
   * TESTS ONLY: connect to a local TLS test server. Never derived from
   * user input; production code never sets it.
   */
  testOverrides?: { port: number; ca: string; allowLoopback: boolean };
}

export type SafeFetcher = (url: string, options: SafeFetchOptions) => Promise<SafeFetchResponse>;

export interface SafeFetchResponse {
  url: string;
  status: number;
  headers: IncomingHttpHeaders;
  contentType: string | null;
  body: Buffer;
}

const defaultResolver: Resolver = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

function validateUrl(raw: string, allowedHosts: ReadonlySet<string>): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('invalid_url', 'Invalid URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port !== '' && url.port !== '443')) {
    throw new SafeFetchError('invalid_url', 'Only plain https URLs are allowed');
  }
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new SafeFetchError('host_not_allowed', `Host not allowed: ${url.hostname}`);
  }
  return url;
}

async function resolvePublic(
  hostname: string,
  resolver: Resolver,
  allowLoopback = false,
): Promise<LookupAddress> {
  let addresses: LookupAddress[];
  try {
    addresses = await resolver(hostname);
  } catch (error) {
    throw new SafeFetchError('dns_failed', `DNS lookup failed for ${hostname}`, { cause: error });
  }
  if (addresses.length === 0) throw new SafeFetchError('dns_failed', `No address for ${hostname}`);
  // Fail closed: one non-public answer rejects the whole host.
  const permitted = (address: string) =>
    isPublicAddress(address) || (allowLoopback && (address === '127.0.0.1' || address === '::1'));
  if (addresses.some((entry) => !permitted(entry.address))) {
    throw new SafeFetchError('private_address', `Host ${hostname} resolves to a non-public address`);
  }
  const first = addresses[0];
  if (!first) throw new SafeFetchError('dns_failed', `No address for ${hostname}`);
  return first;
}

function pinnedLookup(address: LookupAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  };
}

function mediaType(header: string | undefined): string | null {
  if (!header) return null;
  return header.split(';')[0]?.trim().toLowerCase() || null;
}

function decode(response: IncomingMessage): NodeJS.ReadableStream {
  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return response.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return response.pipe(zlib.createInflate());
  if (encoding === 'br') return response.pipe(zlib.createBrotliDecompress());
  return response;
}

function requestOnce(
  url: URL,
  address: LookupAddress,
  options: SafeFetchOptions,
  signal: AbortSignal,
): Promise<{ response: IncomingMessage; body: Buffer | null }> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: 'https:',
        hostname: url.hostname,
        servername: url.hostname,
        port: options.testOverrides?.port ?? 443,
        ca: options.testOverrides?.ca,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        agent: false,
        lookup: pinnedLookup(address),
        headers: {
          'user-agent': options.userAgent,
          accept: options.accept ?? options.contentTypes.join(', '),
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'de-DE,de;q=0.9',
        },
        signal,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          resolve({ response, body: null });
          return;
        }
        const declared = Number(response.headers['content-length'] ?? 0);
        if (declared > options.maxBytes) {
          response.destroy();
          reject(new SafeFetchError('too_large', 'Response too large'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const stream = decode(response);
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            response.destroy();
            reject(new SafeFetchError('too_large', 'Response too large'));
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => resolve({ response, body: Buffer.concat(chunks) }));
        stream.on('error', (error) => reject(new SafeFetchError('network', 'Failed to read response', { cause: error })));
      },
    );
    request.on('error', (error) => {
      if (signal.aborted) {
        const reason: unknown = signal.reason;
        const timedOut = reason instanceof DOMException && reason.name === 'TimeoutError';
        reject(new SafeFetchError(timedOut ? 'timeout' : 'aborted', timedOut ? 'Request timed out' : 'Request aborted'));
        return;
      }
      reject(new SafeFetchError('network', 'Network error', { cause: error }));
    });
    request.end();
  });
}

export const safeFetch: SafeFetcher = async (rawUrl, options) => {
  const resolver = options.resolver ?? defaultResolver;
  const maxRedirects = options.maxRedirects ?? 3;
  const deadline = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;

  let current = validateUrl(rawUrl, options.allowedHosts);
  for (let redirects = 0; ; redirects += 1) {
    if (signal.aborted) {
      throw new SafeFetchError(deadline.aborted ? 'timeout' : 'aborted', 'Request aborted');
    }
    const address = await resolvePublic(current.hostname, resolver, options.testOverrides?.allowLoopback);
    const { response, body } = await requestOnce(current, address, options, signal);
    const status = response.statusCode ?? 0;

    if (body === null) {
      if (redirects >= maxRedirects) throw new SafeFetchError('too_many_redirects', 'Too many redirects');
      const location = String(response.headers.location);
      current = validateUrl(new URL(location, current).toString(), options.allowedHosts);
      continue;
    }

    const contentType = mediaType(response.headers['content-type']);
    if (status >= 200 && status < 300 && (!contentType || !options.contentTypes.includes(contentType))) {
      throw new SafeFetchError('bad_content_type', `Unexpected content type: ${contentType ?? 'none'}`);
    }
    return { url: current.toString(), status, headers: response.headers, contentType, body };
  }
};
