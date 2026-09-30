import net from 'node:net';
import type { FastifyRequest } from 'fastify';

/**
 * The visitor address used for rate limits. Behind a CDN that sets a
 * trusted client-address header (Cloudflare: `CF-Connecting-IP`, which it
 * refuses to accept from clients) that header is used; otherwise the
 * address Fastify derived from the socket and `TRUST_PROXY`.
 */
export function clientAddress(request: FastifyRequest, trustedHeader: string | null): string {
  if (trustedHeader) {
    const value = request.headers[trustedHeader];
    const address = typeof value === 'string' ? value.trim() : undefined;
    if (address && net.isIP(address) !== 0) return address;
  }
  return request.ip;
}
