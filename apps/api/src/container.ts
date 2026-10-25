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
import { OwnedCarService } from './application/owned-car-service';
import { CarLogService } from './application/car-log-service';
import { ReminderService } from './application/reminder-service';
import { SavedSearchService } from './application/saved-search-service';
import { UsageService } from './application/usage-service';
import { SponsorAdService } from './application/sponsor-ad-service';
import { RdwService, type RdwFetch } from './application/rdw-service';
import { ChatService } from './application/chat/chat-service';
import { createChatTools } from './application/chat/chat-tools';
import { ChatUsageService } from './application/chat/chat-usage';
import type { AppConfig } from './config/env';
import { AnthropicChatModel } from './infrastructure/ai/anthropic-chat-model';
import type { ChatModel } from './infrastructure/ai/chat-model';
import { createAiProvider } from './infrastructure/ai/create-provider';
import { MockChatModel } from './infrastructure/ai/mock-chat-model';
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
import type { ValuationProvider } from './infrastructure/valuation/types';

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
  savedSearches: SavedSearchService;
  ownedCars: OwnedCarService;
  carLog: CarLogService;
  reminders: ReminderService;
  billing: BillingService;
  account: AccountService;
  email: EmailService;
  contracts: ContractService;
  /** Photos only come with retrieved listings, so pasted text never gets a photo analysis. */
  photoAnalysisAvailable: boolean;
  sponsorAds: SponsorAdService;
  rdw: RdwService;
  /** The chat assistant; null without a chat model. */
  chat: ChatService | null;
}

export interface ServiceOverrides {
  db?: Db;
  retriever?: ListingUrlRetriever;
  aiProvider?: AiProvider | null;
  billing?: BillingService;
  email?: EmailService;
  now?: () => Date;
  rdwFetch?: RdwFetch;
  valuation?: ValuationProvider;
  /** null switches the chat off. */
  chatModel?: ChatModel | null;
}

/** Claude with an API key, the scripted model outside production with AI_PROVIDER=mock. */
function createChatModel(config: AppConfig, logger: FastifyBaseLogger): ChatModel | null {
  if (!config.chat.enabled) return null;
  if (config.ai.provider === 'anthropic' && config.ai.anthropic.apiKey) {
    return new AnthropicChatModel({
      apiKey: config.ai.anthropic.apiKey,
      model: config.chat.model,
      effort: config.chat.effort,
      onRejected: (detail) => logger.warn({ detail }, 'chat model request rejected'),
    });
  }
  if (config.ai.provider === 'mock' && !config.isProduction) return new MockChatModel();
  return null;
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
  const analyses = new AnalysisService({
    db,
    retriever,
    enricher,
    usage,
    analytics,
    logger,
    now,
    valuation: overrides.valuation ?? null,
  });
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
  const savedSearches = new SavedSearchService(db, analytics, now);
  const ownedCars = new OwnedCarService(db, analytics, now);
  const carLog = new CarLogService(db, now);
  const reminders = new ReminderService(
    db,
    email,
    { siteUrl: config.publicSiteUrl, operator: config.operator, secret: config.cookieSecret, now },
    logger,
  );
  const account = new AccountService(db, auth, billing);

  const rdw = new RdwService({
    ...config.rdw,
    ...(overrides.rdwFetch ? { mode: 'live' as const, fetchRows: overrides.rdwFetch } : {}),
    now,
  });
  const chatModel =
    overrides.chatModel === undefined ? createChatModel(config, logger) : overrides.chatModel;

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
    savedSearches,
    ownedCars,
    carLog,
    reminders,
    billing,
    account,
    email,
    contracts,
    photoAnalysisAvailable,
    sponsorAds: new SponsorAdService(db, config.sponsorAds, now, logger),
    rdw,
    chat: chatModel
      ? new ChatService({
          model: chatModel,
          tools: createChatTools({ analyses, rdw }),
          usage: new ChatUsageService(db, config.chat, config.cookieSecret, now),
          logger,
          secret: config.cookieSecret,
          now,
        })
      : null,
  };
}
