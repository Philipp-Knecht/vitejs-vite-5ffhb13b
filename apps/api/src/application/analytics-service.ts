import {
  ANALYTICS_PROP_KEYS,
  AnalyticsPropsSchema,
  type AnalyticsEventName,
  type AnalyticsProps,
} from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../infrastructure/db/client';

/**
 * First-party, privacy-conscious analytics: only the event name, a small
 * allowlisted property set and a timestamp are stored. No user or visitor
 * ids, no IP addresses, no user agents. Failures never affect requests.
 */
export class AnalyticsService {
  constructor(
    private readonly db: Db,
    private readonly enabled: boolean,
    private readonly logger: FastifyBaseLogger,
  ) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Drops unknown keys before validation so extra client props never fail an event. */
  static sanitize(props: Record<string, unknown> | undefined): AnalyticsProps | undefined {
    if (!props) return undefined;
    const allowed = Object.fromEntries(
      Object.entries(props).filter(([key]) => (ANALYTICS_PROP_KEYS as readonly string[]).includes(key)),
    );
    const parsed = AnalyticsPropsSchema.safeParse(allowed);
    return parsed.success ? parsed.data : undefined;
  }

  track(name: AnalyticsEventName, props?: AnalyticsProps): void {
    if (!this.enabled) return;
    this.db.analyticsEvent
      .create({ data: { name, props: (props ?? undefined) } })
      .catch((error: unknown) => this.logger.warn({ op: 'analytics.track', err: error }, 'analytics event dropped'));
  }
}
