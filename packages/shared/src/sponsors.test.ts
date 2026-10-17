import { describe, expect, it } from 'vitest';
import { germanDay, SPONSOR_IMAGE_PATTERN, sponsorAdRuns } from './sponsors';

describe('sponsors', () => {
  it('runs campaigns on German calendar days, both ends included', () => {
    // 23:30 UTC on 31 October is already 1 November in Germany.
    expect(germanDay(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
    const ad = { from: '2026-11-01', until: '2026-11-30' };
    expect(sponsorAdRuns(ad, '2026-10-31')).toBe(false);
    expect(sponsorAdRuns(ad, '2026-11-01')).toBe(true);
    expect(sponsorAdRuns(ad, '2026-11-30')).toBe(true);
    expect(sponsorAdRuns(ad, '2026-12-01')).toBe(false);
    expect(sponsorAdRuns({}, '2030-01-01')).toBe(true);
  });

  it('takes images only from the own site', () => {
    expect(SPONSOR_IMAGE_PATTERN.test('/sponsors/autohaus-muster.webp')).toBe(true);
    expect(SPONSOR_IMAGE_PATTERN.test('/og-image.png')).toBe(true);
    for (const path of [
      'https://cdn.example/ad.png',
      '//cdn.example/ad.png',
      '/sponsors/../secret.png',
      '/sponsors/ad.svg',
      '/sponsors/Ad.PNG',
      'sponsors/ad.png',
    ])
      expect(SPONSOR_IMAGE_PATTERN.test(path)).toBe(false);
  });
});
