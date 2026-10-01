import { buildEntitlements } from '@kaufcheck/domain';
import type { Entitlements, Plan } from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import { AccountService } from './application/account-service';
import { AiEnricher } from './application/ai-enricher';
import { AnalysisService } from './application/analysis-service';
import { AnalyticsService } from './application/analytics-service';
import { AuthService } from './application/auth-service';
import { ContractService } from './application/contract-service';
import { SavedListingService } from './application/saved-listing-service';
import { UsageService } from './application/usage-service';
import type { AppConfig } from './config/env';
import { createAiProvider } from './infrastructure/ai/create-provider';
import type { AiProvider } from './infrastructure/ai/types';
import {
  NotConfiguredBillingService,
  type BillingService,
} from './infrastructure/billing/billing-service';
import { StripeBillingService } from './infrastructure/billing/stripe-billing-service';
import { createDb, type Db } from './infrastructure/db/client';
import {
  ConsoleEmailService,
  DisabledEmailService,
  SmtpEmailService,
  type EmailService,
} from './infrastructure/email/email-service';
import {
  DisabledListingRetriever,
  FixtureListingRetriever,
  KleinanzeigenLiveRetriever,
} from './infrastructure/listing-sources/kleinanzeigen-retriever';
import type { ListingUrlRetriever } from './infrastructure/listing-sources/types';
import { RobotsPolicy } from './infrastructure/net/robots-policy';

export interface Services {
  config: AppConfig;
  db: Db;
  plans: Record<Plan, Entitlements>;
  retriever: ListingUrlRetriever;
  enricher: AiEnricher | null;
  usage: UsageService;
  analytics: AnalyticsService;
  analyses: AnalysisService;
  auth: AuthService;
  savedListings: SavedListingService;
  billing: BillingService;
  account: AccountService;
  email: EmailService;
  contracts: ContractService;
  /** Photos only come with retrieved listings, so pasted text never gets a photo analysis. */
  photoAnalysisAvailable: boolean;
}

export interface ServiceOverrides {
  db?: Db;
  retriever?: ListingUrlRetriever;
  aiProvider?: AiProvider | null;
  billing?: BillingService;
  email?: EmailService;
  now?: () => Date;
}

function createRetriever(config: AppConfig): ListingUrlRetriever {
  switch (config.fetch.mode) {
    case 'off':
      return new DisabledListingRetriever();
    case 'fixtures':
      return new FixtureListingRetriever(config.fetch.fixturesDir);
    case 'live':
      return new KleinanzeigenLiveRetriever({
        robots: new RobotsPolicy({
          userAgent: config.fetch.userAgent,
          agentToken: 'KaufCheckBot',
          timeoutMs: config.fetch.timeoutMs,
        }),
        userAgent: config.fetch.userAgent,
        timeoutMs: config.fetch.timeoutMs,
        maxBytes: config.fetch.maxBytes,
        ratePerMinute: config.fetch.ratePerMinute,
      });
  }
}

function createEmail(config: AppConfig, logger: FastifyBaseLogger): EmailService {
  if (config.email.transport === 'smtp' && config.email.smtpUrl && config.email.from) {
    return new SmtpEmailService(config.email.smtpUrl, config.email.from);
  }
  if (config.email.transport === 'console' && !config.isProduction)
    return new ConsoleEmailService(logger);
  return new DisabledEmailService();
}

/** Composition root: wires infrastructure into application services. */
export function createServices(
  config: AppConfig,
  logger: FastifyBaseLogger,
  overrides: ServiceOverrides = {},
): Services {
  const db = overrides.db ?? createDb(config.databaseUrl);
  const now = overrides.now ?? (() => new Date());
  const plans = buildEntitlements({
    anonymousMonthlyAnalyses: config.limits.anonymousMonthlyAnalyses,
    freeMonthlyAnalyses: config.limits.freeMonthlyAnalyses,
    proMonthlyAnalyses: config.limits.proMonthlyAnalyses,
  });

  const provider =
    overrides.aiProvider === undefined ? createAiProvider(config) : overrides.aiProvider;
  const enricher = provider
    ? new AiEnricher(
        provider,
        {
          timeoutMs: config.ai.timeoutMs,
          maxConcurrency: config.ai.maxConcurrency,
          photoAnalysis: config.ai.photoAnalysis && config.showListingPhotos,
          maxPhotos: config.ai.maxPhotos,
          imageUserAgent: config.fetch.userAgent,
          imageTimeoutMs: config.fetch.timeoutMs,
        },
        logger,
      )
    : null;

  const retriever = overrides.retriever ?? createRetriever(config);
  const usage = new UsageService(db, now);
  const analytics = new AnalyticsService(db, config.analyticsEnabled, logger);
  const analyses = new AnalysisService({ db, retriever, enricher, usage, analytics, logger, now });
  const email = overrides.email ?? createEmail(config, logger);
  const auth = new AuthService(db, analyses.analyses, email, config.publicSiteUrl, now);
  const billing =
    overrides.billing ??
    (config.stripe
      ? new StripeBillingService(db, config.stripe, logger)
      : new NotConfiguredBillingService(db));
  const photoAnalysisAvailable =
    retriever.mode !== 'off' && (enricher?.photoAnalysisAvailable ?? false);
  const contracts = new ContractService(
    db,
    billing,
    email,
    {
      siteUrl: config.publicSiteUrl,
      operator: config.operator,
      pro: plans.pro,
      photoAnalysisAvailable,
      now,
    },
    logger,
  );
  const savedListings = new SavedListingService(db, analyses, analytics, now);
  const account = new AccountService(db, auth, billing);

  return {
    config,
    db,
    plans,
    retriever,
    enricher,
    usage,
    analytics,
    analyses,
    auth,
    savedListings,
    billing,
    account,
    email,
    contracts,
    photoAnalysisAvailable,
  };
}
