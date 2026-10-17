import { germanDay, sponsorAdRuns, type AdPlacement, type SponsorAdDto } from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { SponsorAdConfig } from '../config/env';
import type { Db } from '../infrastructure/db/client';
import type { Actor } from './actor';

/**
 * Ads sold directly. The server picks a running ad and counts deliveries and
 * clicks per campaign and German day – totals only, nothing measured in the
 * browser, nothing counted with Do Not Track / Global Privacy Control.
 * Counting never fails a request.
 */
export class SponsorAdService {
  constructor(
    private readonly db: Db,
    private readonly ads: readonly SponsorAdConfig[],
    private readonly now: () => Date,
    private readonly logger: FastifyBaseLogger,
    private readonly random: () => number = Math.random,
  ) {}

  get configured(): boolean {
    return this.ads.length > 0;
  }

  private running(day: string): SponsorAdConfig[] {
    return this.ads.filter((ad) => sponsorAdRuns(ad, day));
  }

  /** Placements with an ad running today. */
  placements(): AdPlacement[] {
    const running = this.running(germanDay(this.now()));
    return (['result_bottom', 'guide_bottom'] as const).filter((placement) =>
      running.some((ad) => ad.placements.includes(placement)),
    );
  }

  /** One running ad for the placement, or null; visitors with Pro get none. */
  async pick(placement: AdPlacement, actor: Actor): Promise<SponsorAdDto | null> {
    if (!actor.entitlements.showAds) return null;
    const day = germanDay(this.now());
    const candidates = this.running(day).filter((ad) => ad.placements.includes(placement));
    if (candidates.length === 0) return null;
    const ad = candidates[Math.floor(this.random() * candidates.length)] ?? candidates[0]!;
    if (actor.trackingAllowed) await this.count(ad.id, day, 'deliveries');
    return {
      id: ad.id,
      advertiser: ad.advertiser,
      title: ad.title,
      text: ad.text,
      image: ad.image && ad.imageAlt ? { src: ad.image, alt: ad.imageAlt } : null,
      href: `/go/${ad.id}`,
    };
  }

  /** Where a click on the ad leads; also after the campaign has ended, but then not counted. */
  async click(id: string, count: boolean): Promise<string | null> {
    const ad = this.ads.find((item) => item.id === id);
    if (!ad) return null;
    const day = germanDay(this.now());
    if (count && sponsorAdRuns(ad, day)) await this.count(ad.id, day, 'clicks');
    return ad.url;
  }

  private async count(
    campaign: string,
    day: string,
    field: 'deliveries' | 'clicks',
  ): Promise<void> {
    try {
      await this.db.sponsorAdStat.upsert({
        where: { campaign_day: { campaign, day } },
        create: { campaign, day, [field]: 1 },
        update: { [field]: { increment: 1 } },
      });
    } catch (error) {
      this.logger.warn({ op: 'sponsor_ads.count', err: error }, 'sponsor ad count dropped');
    }
  }
}
