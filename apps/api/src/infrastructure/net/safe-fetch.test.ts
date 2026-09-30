import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { safeFetch, SafeFetchError, type SafeFetchOptions } from './safe-fetch';

const HOST = 'www.kleinanzeigen.de';
let server: https.Server;
let port = 0;
let cert = '';
let dir = '';

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'kc-tls-'));
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    `/CN=${HOST}`,
    '-addext',
    `subjectAltName=DNS:${HOST},DNS:img.kleinanzeigen.de`,
    '-keyout',
    path.join(dir, 'key.pem'),
    '-out',
    path.join(dir, 'cert.pem'),
  ], { stdio: 'ignore' });
  cert = readFileSync(path.join(dir, 'cert.pem'), 'utf8');
  server = https.createServer({ key: readFileSync(path.join(dir, 'key.pem')), cert }, (request, response) => {
    const url = new URL(request.url ?? '/', `https://${HOST}`);
    switch (url.pathname) {
      case '/ok':
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<h1>ok</h1>');
        return;
      case '/ua':
        response.writeHead(200, { 'content-type': 'text/html' }).end(String(request.headers['user-agent']));
        return;
      case '/redirect-same':
        response.writeHead(302, { location: '/ok' }).end();
        return;
      case '/redirect-other':
        response.writeHead(302, { location: 'https://internal.example/secret' }).end();
        return;
      case '/redirect-loop':
        response.writeHead(302, { location: '/redirect-loop' }).end();
        return;
      case '/big-declared':
        response.writeHead(200, { 'content-type': 'text/html', 'content-length': '5000000' }).end('x');
        return;
      case '/big-chunked':
        response.writeHead(200, { 'content-type': 'text/html' });
        for (let i = 0; i < 40; i += 1) response.write('x'.repeat(1024));
        response.end();
        return;
      case '/gzip-bomb':
        response
          .writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
          .end(gzipSync(Buffer.alloc(2_000_000, 'a')));
        return;
      case '/image':
        response.writeHead(200, { 'content-type': 'image/png' }).end('png');
        return;
      case '/slow': {
        const timer = setTimeout(() => response.writeHead(200, { 'content-type': 'text/html' }).end('late'), 2000);
        response.on('close', () => clearTimeout(timer));
        return;
      }
      case '/missing':
        response.writeHead(404, { 'content-type': 'text/html' }).end('nope');
        return;
      default:
        response.writeHead(500).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const loopbackResolver = () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]);

function options(overrides: Partial<SafeFetchOptions> = {}): SafeFetchOptions {
  return {
    allowedHosts: new Set([HOST]),
    userAgent: 'KaufCheckBot/test',
    timeoutMs: 1000,
    maxBytes: 16 * 1024,
    contentTypes: ['text/html'],
    resolver: loopbackResolver,
    testOverrides: { port, ca: cert, allowLoopback: true },
    ...overrides,
  };
}

async function failure(url: string, overrides: Partial<SafeFetchOptions> = {}): Promise<SafeFetchError> {
  try {
    await safeFetch(url, options(overrides));
  } catch (error) {
    if (error instanceof SafeFetchError) return error;
    throw error;
  }
  throw new Error('expected a failure');
}

describe('safeFetch – URL and host validation', () => {
  it.each([
    ['http://www.kleinanzeigen.de/ok', 'invalid_url'],
    ['https://user:pass@www.kleinanzeigen.de/ok', 'invalid_url'],
    ['https://www.kleinanzeigen.de:8443/ok', 'invalid_url'],
    ['https://evil.example/ok', 'host_not_allowed'],
    ['https://127.0.0.1/ok', 'host_not_allowed'],
    ['not a url', 'invalid_url'],
  ])('%s → %s', async (url, kind) => {
    expect((await failure(url)).kind).toBe(kind);
  });

  it('rejects hosts resolving to private addresses, even when only one answer is private', async () => {
    const privateOnly = () => Promise.resolve([{ address: '10.0.0.5', family: 4 }]);
    const mixed = () =>
      Promise.resolve([
        { address: '93.184.216.34', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ]);
    const noTestLoopback = { testOverrides: { port, ca: cert, allowLoopback: false } };
    expect((await failure(`https://${HOST}/ok`, { resolver: privateOnly })).kind).toBe('private_address');
    expect((await failure(`https://${HOST}/ok`, { resolver: mixed })).kind).toBe('private_address');
    expect((await failure(`https://${HOST}/ok`, noTestLoopback)).kind).toBe('private_address');
  });

  it('reports DNS failures', async () => {
    const broken = () => Promise.reject(new Error('ENOTFOUND'));
    expect((await failure(`https://${HOST}/ok`, { resolver: broken })).kind).toBe('dns_failed');
  });
});

describe('safeFetch – transport', () => {
  it('fetches allowed pages and identifies itself honestly', async () => {
    const response = await safeFetch(`https://${HOST}/ok`, options());
    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe('<h1>ok</h1>');
    const ua = await safeFetch(`https://${HOST}/ua`, options());
    expect(ua.body.toString()).toBe('KaufCheckBot/test');
  });

  it('returns non-2xx responses to the caller', async () => {
    expect((await safeFetch(`https://${HOST}/missing`, options())).status).toBe(404);
  });

  it('follows redirects on the same host but never to other hosts', async () => {
    const response = await safeFetch(`https://${HOST}/redirect-same`, options());
    expect(response.url).toBe(`https://${HOST}/ok`);
    expect((await failure(`https://${HOST}/redirect-other`)).kind).toBe('host_not_allowed');
    expect((await failure(`https://${HOST}/redirect-loop`)).kind).toBe('too_many_redirects');
  });

  it('enforces the size limit on declared, streamed and decompressed bodies', async () => {
    expect((await failure(`https://${HOST}/big-declared`)).kind).toBe('too_large');
    expect((await failure(`https://${HOST}/big-chunked`)).kind).toBe('too_large');
    expect((await failure(`https://${HOST}/gzip-bomb`)).kind).toBe('too_large');
  });

  it('enforces the content-type allowlist', async () => {
    expect((await failure(`https://${HOST}/image`)).kind).toBe('bad_content_type');
  });

  it('times out and can be aborted', async () => {
    expect((await failure(`https://${HOST}/slow`, { timeoutMs: 200 })).kind).toBe('timeout');
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    expect((await failure(`https://${HOST}/slow`, { signal: controller.signal })).kind).toBe('aborted');
  });
});
