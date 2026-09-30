import { describe, expect, it } from 'vitest';
import { periodResetsAt, usagePeriod } from '../application/usage-service';
import { hashPassword, randomToken, sha256, verifyPassword } from './crypto';
import { RateLimiter, Semaphore } from './rate-limiter';
import { TtlCache } from './ttl-cache';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('richtig-langes-passwort');
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword('richtig-langes-passwort', stored)).toBe(true);
    expect(await verifyPassword('falsches-passwort', stored)).toBe(false);
  });

  it('salts every hash and normalizes Unicode', async () => {
    const [a, b] = await Promise.all([hashPassword('Müller-Passwort'), hashPassword('Müller-Passwort')]);
    expect(a).not.toBe(b);
    // "ü" as a single code point vs. "u" + combining diaeresis.
    expect(await verifyPassword('Müller-Passwort', a)).toBe(true);
  });

  it('rejects malformed hashes without throwing', async () => {
    expect(await verifyPassword('x', 'plain-text')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false);
  });
});

describe('tokens', () => {
  it('creates unguessable url-safe tokens and stable hashes', () => {
    const token = randomToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(randomToken()).not.toBe(token);
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('usage period', () => {
  it('uses the calendar month in UTC', () => {
    expect(usagePeriod(new Date('2026-09-30T23:59:59Z'))).toBe('2026-09');
    // 00:30 in Berlin on 1 October is still September in UTC.
    expect(usagePeriod(new Date('2026-10-01T00:30:00+02:00'))).toBe('2026-09');
    expect(usagePeriod(new Date('2026-12-31T12:00:00Z'))).toBe('2026-12');
    expect(periodResetsAt(new Date('2026-12-15T12:00:00Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('RateLimiter', () => {
  it('allows a fixed number of requests per sliding window', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect([limiter.tryTake(), limiter.tryTake(), limiter.tryTake()]).toEqual([true, true, false]);
    now = 1000;
    expect(limiter.tryTake()).toBe(true);
  });
});

describe('Semaphore', () => {
  it('never waits and releases each slot once', () => {
    const semaphore = new Semaphore(1);
    const release = semaphore.tryAcquire();
    expect(release).not.toBeNull();
    expect(semaphore.tryAcquire()).toBeNull();
    release?.();
    release?.();
    const next = semaphore.tryAcquire();
    expect(next).not.toBeNull();
    expect(semaphore.tryAcquire()).toBeNull();
  });
});

describe('TtlCache', () => {
  it('expires entries and evicts the oldest beyond its size', () => {
    let now = 0;
    const cache = new TtlCache<number>(100, 2, () => now);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    now = 100;
    expect(cache.get('c')).toBeUndefined();
  });
});
