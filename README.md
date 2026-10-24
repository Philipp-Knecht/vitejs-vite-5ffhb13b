# KaufCheck

**Gebraucht kaufen. Besser entscheiden.**

KaufCheck is a starting point for buying a used car in Germany: **find** (one search for
mobile.de, AutoScout24, Kleinanzeigen, eBay and other marketplaces, plus researched model
knowledge), **check** (evaluate a listing) and **decide** (save and compare offers).

The car search (`/auto-finden`) turns the visitor's filters into links to each marketplace's own
result page; the visitor opens them there. Models in the catalog (`packages/catalog`) come with
their generations, strengths, known weaknesses with sources (ADAC, TÜV-Report, recalls, trade
press), engines to prefer or avoid and inspection tips. Each researched model gets a prerendered
page (`/modelle/<id>`, overview at `/modelle`). The advisor (`/auto-berater`) asks a few questions
about budget, use and space and ranks the researched models with a transparent points system
(`packages/catalog/src/advisor.ts`); it is linked once at least 40 models are researched
(`apps/web/src/features/advisor/availability.ts`). The listing check shows the known weaknesses of
the listed model's generation, the comparison orders saved offers by the buyer's own priorities
(`packages/shared/src/comparison-ranking.ts`), and Pro members can save searches and download an
analysis as a PDF folder for the viewing (built in the browser with jsPDF,
`apps/web/src/features/pdf`). Result and
model pages explain how to check recalls with the FIN and link the manufacturers' official recall
pages and the KBA recall database (`packages/catalog/src/recalls.ts`); KaufCheck queries none of
them itself. Pro members can also prepare the price negotiation: points from the
listing that apply, their own findings and a factual message to the seller, without suggested
amounts (`packages/shared/src/negotiation.ts`). After the purchase, „Mein Auto“ (`/mein-auto`, one car free, up to
ten with Pro) keeps the car in view: next HU from the badge with a calendar file and an e-mail reminder,
the generation's known weaknesses, the recall check and the cost calculator
(`apps/api/src/application/owned-car-service.ts`, `apps/web/src/features/my-car`). Only what the
user enters is stored – no FIN, no plate. The web app is installable, and a check can be saved for
the inspection on request („Offline verfügbar machen“): the page stores the check, the app shell
and its built files, and the service worker (`apps/web/public/sw.js`) serves them when there is no
reception. Nothing is stored without that request; the copy is deleted on logout, an account switch
and account deletion. For a private purchase, Pro members can fill in
a purchase contract on `/kaufvertrag` and download it as a PDF with a handover record and receipt;
the text and its checks live in `packages/shared/src/sale-contract.ts`, the PDF is built in the
browser with the embedded Liberation Sans font (SIL Open Font License, `fonts/OFL.txt`) and nothing
is stored or sent (reasons for the clauses in DECISIONS.md). To sell the car again, `/auto-verkaufen`
is a guide from the documents to the deregistration, and Pro members build a listing text from
their answers (`packages/shared/src/listing-text.ts`, fixed rules, no AI). It asks the same
questions about the car's history as the contract and hands them over to it, so that listing and
contract say the same. Pro members keep a cost book per car (`/mein-auto/<id>/kostenbuch`,
`apps/api/src/application/car-log-service.ts`, figures in `packages/shared/src/car-log.ts`):
fill-ups, service, repairs and other costs, the costs per month and per km, the consumption between
full fill-ups, a CSV export and the self-kept service history as a PDF without prices. After Pro
ends, the entries stay readable, exportable and deletable; no receipts are uploaded. In the
comparison, Pro members put the monthly costs of their saved offers side by side
(`packages/shared/src/monthly-costs.ts`): depreciation, fuel or electricity, tax, insurance and
workshop from their own figures – KaufCheck has no price or consumption data and assumes none.
A financing calculator (`packages/shared/src/financing.ts`) computes the monthly rate and the credit costs (interest and fees) from the effective annual rate of an offer; it is free in the cost calculator, and in the
comparison the credit costs (interest and fees, not the repayment) are added to the monthly costs.
Owners can also switch on e-mail reminders per car (`/mein-auto/<id>/erinnerungen`; the HU
reminder with any account, the others with Pro;
`apps/api/src/application/reminder-service.ts`, rules in `packages/shared/src/reminders.ts`): HU,
inspection, brake fluid and tyres, or a calendar file for each. The account address is confirmed
by a link first (accounts are not verified at sign-up). A timer in the server process (hourly and two minutes after start) sends what is due,
each due date once, with a one-click unsubscribe link (RFC 8058, signed with `COOKIE_SECRET`) and
no advertising. Reminders need SMTP and the operator details (`VITE_IMPRINT_*`,
`VITE_CONTACT_EMAIL`) for the footer; without them the page offers calendar files only.

For the listing check, a user pastes the listing text (or a link); KaufCheck extracts and
normalizes the vehicle data and shows a mobile-first dashboard:

- what the listing says, with the origin of every statement (_Aus dem Inserat_, _Berechnet_,
  _Vermutung_, _Nicht bekannt_),
- which important information is missing,
- evidence-based observations (for example two different mileages) and checks to do on site,
- questions for the seller (formal or informal), ready to copy or as a chat message,
- an inspection checklist, stored in the browser,
- price calculations – and a market comparison only when enough verified comparables exist.

KaufCheck never invents data, never gives a buying recommendation and never circumvents technical
protections of the listing site. The UI is German; code and documentation are English.

## Contents

- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Development](#development)
- [Testing](#testing)
- [Production build](#production-build)
- [Deployment on Render](#deployment-on-render)
- [AI provider configuration](#ai-provider-configuration)
- [Stripe configuration](#stripe-configuration)
- [Analytics configuration](#analytics-configuration)
- [Architecture](#architecture)
- [Security](#security)
- [Legal](#legal)
- [Roadmap](#roadmap)

## Setup

Requirements: **Node.js 22** (see `.nvmrc`), **npm 10** and **PostgreSQL 16**.

```bash
npm ci                         # installs all workspaces and generates the Prisma client
cp .env.example .env           # development defaults: fixtures, no AI, no payments

# PostgreSQL matching the default DATABASE_URL (or use an existing server):
docker run -d --name kaufcheck-db -p 5432:5432 \
  -e POSTGRES_USER=kaufcheck -e POSTGRES_PASSWORD=kaufcheck -e POSTGRES_DB=kaufcheck \
  postgres:16-alpine

npm run db:migrate             # applies the migrations to DATABASE_URL
npm run dev                    # API on :3000, web app on :5173 (with /api proxy)
```

Open <http://localhost:5173>. In development the listing links are served from synthetic fixtures
(`apps/api/fixtures/listings`, see its README): try
`https://www.kleinanzeigen.de/s-anzeige/audi-a7/2912345678-216-3331`, or the ad id `2919999999` to
see the text fallback for a blocked page. „Fiktives Beispiel ansehen“ runs the built-in fictional
example.

## Environment variables

All variables are documented in [`.env.example`](.env.example). The API validates them at startup
and refuses unsafe production settings (for example the AI mock, fixture listings, console e-mail
or a short cookie secret). Only `VITE_*` variables are compiled into the browser bundle.

| Group             | Variables                                                                                                                                                 | Notes                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Core              | `PORT`, `HOST`, `PUBLIC_SITE_URL`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `CLIENT_IP_HEADER`, `LOG_LEVEL`                                                      | `PUBLIC_SITE_URL` is required in production and is also used at build time for canonical URLs. |
| Database, secrets | `DATABASE_URL`, `COOKIE_SECRET`                                                                                                                           | `COOKIE_SECRET`: at least 32 random characters in production.                                  |
| Listing retrieval | `LISTING_FETCH_MODE` (`off`/`live`/`fixtures`), `FETCH_USER_AGENT`, `FETCH_TIMEOUT_MS`, `FETCH_MAX_BYTES`, `FETCH_RATE_PER_MINUTE`, `SHOW_LISTING_PHOTOS` | Production default is `off`. `fixtures` is development/test only.                              |
| AI                | `AI_PROVIDER`, `ANTHROPIC_*`, `OPENAI_*`, `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY`, `AI_PHOTO_ANALYSIS`, `AI_MAX_PHOTOS`                                     | See [AI provider configuration](#ai-provider-configuration).                                   |
| Plans             | `ANON_MONTHLY_ANALYSES`, `FREE_MONTHLY_ANALYSES`, `PRO_MONTHLY_ANALYSES`, `ANALYZE_RATE_PER_MINUTE`, `REGISTER_RATE_PER_HOUR`                             | Defaults: 3 without account, 10 free, 300 Pro per calendar month (UTC).                        |
| Payments          | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `VAT_MODE`, `STRIPE_PAYMENT_METHODS`                                                 | All three Stripe values or none; payments also need SMTP e-mail and the full operator details. |
| Ads               | `ADSENSE_CLIENT`, `ADSENSE_SLOT`                                                                                                                          | See [Google AdSense](#google-adsense).                                                         |
| Affiliate         | `AFFILIATE_CAR_INSURANCE_URL`, `AFFILIATE_CAR_INSURANCE_NAME`                                                                                             | See [Affiliate link](#affiliate-link).                                                         |
| Own ads           | `SPONSOR_ADS`                                                                                                                                             | See [Ads sold directly](#ads-sold-directly).                                                   |
| E-mail            | `EMAIL_TRANSPORT` (`none`/`smtp`/`console`), `SMTP_URL`, `EMAIL_FROM`                                                                                     | Needed for password reset; without e-mail the feature is shown as unavailable.                 |
| Operations        | `ANALYTICS_ENABLED`, `SERVE_WEB`, `WEB_DIST_DIR`, `ANON_RETENTION_DAYS`, `HOSTING_PROVIDER`                                                               | `HOSTING_PROVIDER=render` names Render in the privacy policy (detected automatically there).   |
| Web (build time)  | `VITE_IMPRINT_NAME`, `VITE_IMPRINT_ADDRESS` (lines separated by `\|`), `VITE_CONTACT_EMAIL`, `VITE_CONTACT_PHONE`, `VITE_ADS_PROVIDER`                    | The imprint is legally required in Germany; the server reads the same values for contracts.    |
| Tests             | `TEST_DATABASE_URL`, `E2E_DATABASE_URL`                                                                                                                   | Defaults: `kaufcheck_test` and `kaufcheck_e2e` on localhost.                                   |

Do not set `NODE_ENV` in `.env`: it defaults to `development`, the Docker image sets `production`,
and a `NODE_ENV` in `.env` would turn `vite build` into a development build (the build aborts in
that case).

## Database

PostgreSQL via Prisma 7 (driver adapter `@prisma/adapter-pg`). Schema: `apps/api/prisma/schema.prisma`,
migrations: `apps/api/prisma/migrations`.

```bash
npm run db:migrate    # development: create/apply migrations (prisma migrate dev)
npm run db:deploy     # production/CI: apply pending migrations (prisma migrate deploy)
npm run db:generate   # regenerate the client (also runs on npm install)
```

Main entities: `User`, `Session` (only the SHA-256 of the token is stored), `PasswordResetToken`,
`Listing` (normalized snapshot, contact data redacted), `Vehicle`, `Analysis` (result JSON, rules
version, AI status), `SellerQuestion`, `SavedListing`, `Usage` (monthly quota per account or
anonymous id), `Subscription`, `BillingEvent` (webhook idempotency) and `AnalyticsEvent`.

A maintenance job runs every 6 hours in the server process: it deletes expired sessions, reset
tokens and reminder confirmation links, anonymous analyses older than `ANON_RETENTION_DAYS`, orphaned listings, and usage rows and
analytics events older than 400 days. Deleting an account removes all of its data.

To grant Pro manually (support cases, or while payments are not set up):

```bash
npm run user:set-plan -w @kaufcheck/api -- nutzer@example.de pro
```

## Development

| Command                           | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run dev`                     | API (tsx watch) and Vite dev server with a `/api` proxy |
| `npm run check`                   | Format check, lint, typecheck and unit tests            |
| `npm run lint` / `npm run format` | ESLint (type-aware, React Compiler rules) / Prettier    |
| `npm run typecheck`               | TypeScript for all workspaces                           |
| `npm run catalog:index`           | Rebuilds `packages/catalog/data/index.json` (see below) |
| `npm run catalog:engines`         | Rebuilds the engine data from the EEA (see below)       |
| `npm run loan-rate:update`        | Newest Bundesbank average rate for the loan example     |

Model knowledge is one JSON file per model in `packages/catalog/data/models` (format and rules in
its README). After adding or changing a file, run `npm run catalog:index`: the advisor reads the
compact summaries in `data/index.json`, and `src/catalog.test.ts` fails when they are out of date,
when a weakness has no source or when make and class differ from the catalog.

Engine data (displacement, CO₂, consumption per model, year and engine) is in
`packages/catalog/data/engines`, one file per model, and `data/engine-index.json`. `npm run
catalog:engines` builds it from the EEA's „Monitoring of CO2 emissions from passenger cars“ (new
registrations in Germany, licence CC BY 4.0) through its public SQL API: names are mapped to the
catalog in `src/engine-match.ts`, other models with at least 5,000 registrations get a file of their
own. Each year is in the EEA table twice; the final figures are used, the provisional ones only for a
year without final ones (marked in the index). A typical CO₂ value needs half of an engine's cars to
report it. The raw rows are cached per query in the system temp directory (`ENGINES_CACHE`); delete
the cache to fetch new data. The tax calculator offers the engines and names source and licence.

Development helpers, all clearly labelled in the UI and rejected in production:

- `LISTING_FETCH_MODE=fixtures` serves synthetic listing pages instead of the network.
- `AI_PROVIDER=mock` produces simulated AI output („Simulierte KI-Einschätzung“).
- `EMAIL_TRANSPORT=console` writes password-reset e-mails to the server log.
- `VITE_ADS_PROVIDER=placeholder` shows labelled ad placeholders for layout work.

## Testing

```bash
npm test                  # unit tests: shared, domain, API (no database needed)
npm run test:integration  # API integration tests against PostgreSQL (TEST_DATABASE_URL)
npm run test:e2e          # production build + Playwright end-to-end tests (E2E_DATABASE_URL)
```

- **Unit** (Vitest): URL recognition, SSRF IP policy, the SSRF-safe fetcher against a local TLS
  server (redirects, size limits, gzip bombs, timeouts), robots.txt handling, the Kleinanzeigen
  parser and pasted-text parser, normalization, description signals, completeness, price
  calculations, observations, AI output validation and merging, the Anthropic/OpenAI providers
  (fake clients), configuration validation and password hashing.
- **Integration** (Vitest + PostgreSQL): the analysis pipeline including NDJSON stages, text
  fallback, redaction and verified comparables; accounts, sessions, password reset and account
  deletion; usage limits including concurrent requests; saved listings and comparison; CSRF, body
  limits, rate limits and security headers; Stripe webhooks; data retention. The test database is
  created and migrated automatically (the database user needs the `CREATEDB` privilege); its name
  must contain `test`.
- **End-to-end** (Playwright, Chromium): homepage → analysis, failed retrieval → text fallback,
  save/compare/rename/delete with a new account, the free limit, mobile layout (390 px), SEO
  output without JavaScript, and WCAG 2.1 A/AA checks with axe-core. The server runs the
  production build with fixtures and the AI mock.

## Production build

```bash
PUBLIC_SITE_URL=https://kaufcheck.example npm run build   # web (with prerendering) + API bundle
NODE_ENV=production npm start                              # node apps/api/dist/server.js
```

`npm run build` creates `apps/web/dist` (hashed assets, prerendered pages under `_pages/`,
`sitemap.xml`, `robots.txt`, an empty `noindex` shell for client-side routes) and
`apps/api/dist/server.js` (esbuild bundle; npm dependencies stay external). In production the API
serves the web app on the same origin, returns real `404` status codes for unknown paths and
exposes `GET /api/health`.

**Docker** – multi-stage image, runs as the unprivileged `node` user and applies migrations on
start (`RUN_MIGRATIONS=false` to skip, e.g. when several instances start at once):

```bash
docker build --build-arg PUBLIC_SITE_URL=https://kaufcheck.example -t kaufcheck .
cp .env.docker.example .env.docker          # set POSTGRES_PASSWORD, COOKIE_SECRET, ...
docker compose --env-file .env.docker up --build
```

Behind a reverse proxy set `TRUST_PROXY=1` (number of trusted hops) so rate limits use the client
address. HSTS and `upgrade-insecure-requests` are sent when `PUBLIC_SITE_URL` uses HTTPS.

## Deployment on Render

[`render.yaml`](render.yaml) is a [Render Blueprint](https://render.com/docs/blueprint-spec): the
Docker image as a web service and a PostgreSQL database, both in Frankfurt. On the Hobby workspace
this costs about $13 per month (web service `0.5c-512mb` $7, database `0.1c-256mb` $6 with 1 GB
storage that grows automatically when needed).

1. Merge into `main`. The Blueprint deploys `main` and every later commit on it.
2. In the Render dashboard choose **New → Blueprint** and select this repository.
3. Enter the requested values:
   - `PUBLIC_SITE_URL` – the public HTTPS address, e.g. `https://kaufcheck.onrender.com` or your
     own domain
   - `VITE_IMPRINT_NAME`, `VITE_IMPRINT_ADDRESS` (lines separated by `|`) and `VITE_CONTACT_EMAIL`
     – the operator details for the imprint and the privacy policy
4. Apply. The first build takes a few minutes; migrations run when the container starts.

Render passes environment variables to the Docker build as build arguments, so the build-time
values above reach the image. `COOKIE_SECRET` is generated, `DATABASE_URL` uses the internal
database address and the database accepts no connections from the internet.

`PUBLIC_SITE_URL` is used at build time (canonical URLs, sitemap) and at runtime (allowed origins,
secure cookies). If Render assigns a different `onrender.com` address than the one you entered, or
you add a custom domain later, change it in the service's **Environment** settings and deploy
again. Render asks for `sync: false` values only when the Blueprint is created; later changes are
made there too, as are optional features (AI, Stripe, SMTP for password resets – see below).

### Own domain

The Blueprint lists `kaufcheck-app.de` under `domains`; Render adds `www.kaufcheck-app.de` and
redirects it to the root domain (or add the domain under **Settings → Custom Domains**).

1. At the DNS provider: an `A` record for the root domain pointing to `216.24.57.1` and a `CNAME`
   record `www` pointing to `kaufcheck.onrender.com`. Delete `AAAA` records for the root domain –
   Render only answers over IPv4.
2. Wait until Render shows both names as verified with a certificate.
3. Set `PUBLIC_SITE_URL` to `https://kaufcheck-app.de` and deploy. Pages requested under the
   `onrender.com` address are then redirected (301) to the domain, keeping path and query;
   `/api` requests – the health check and the Stripe webhook – are still answered there.
4. Update the services that know the address: the Stripe webhook endpoint and Google AdSense (add
   the domain as a new site and request a review – AdSense rejected the `onrender.com` address).

Rate limits count per visitor address. On Render that address comes from `CF-Connecting-IP`
(`CLIENT_IP_HEADER`, the default there): Cloudflare, Render's edge network, sets it and rejects
requests that try to send it themselves. `X-Forwarded-For` alone is not reliable on Render because
entries sent by the client are kept, so a forged header would get a fresh limit. `TRUST_PROXY=true`
only serves as the fallback when the header is missing; without either, all visitors would share
the address of Render's proxy and therefore one limit.

## AI provider configuration

The rule engine produces the complete analysis on its own. AI is an optional enrichment that adds
a summary, further observations, checks and seller questions, and – for Pro – a photo analysis.

| `AI_PROVIDER` | Configuration                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `none`        | Default. All statements come from the rules; the UI says so.                                    |
| `anthropic`   | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`), `ANTHROPIC_EFFORT` |
| `openai`      | `OPENAI_API_KEY` and `OPENAI_MODEL` (no default model), optional `OPENAI_BASE_URL`              |
| `mock`        | Development only: simulated, clearly labelled output                                            |

How AI output is handled:

- Providers must return structured JSON (Anthropic: structured outputs with a Zod schema; OpenAI:
  `json_schema` in strict mode). Every response is validated again with Zod; invalid output is
  discarded and the rule-based result is shown with an honest status.
- Quotes must appear verbatim in the listing, statements may not contain prices or mileages that
  are not in the listing, forbidden claims (guarantees, verdicts) are filtered, duplicates of
  rule findings are dropped, and every AI item is labelled _Vermutung_ + _KI_.
- Only listing data is sent (contact data is removed first); no user data. Photos are downloaded
  through the SSRF-safe fetcher (image CDN allowlist, size and type limits).
- Calls run with a timeout and a concurrency cap (`AI_MAX_CONCURRENCY`); when all slots are busy
  the AI step is skipped instead of queued. On models with refusal classifiers (Fable 5+, Opus 5+,
  Sonnet 5.5+) the Anthropic provider enables server-side fallbacks (`fallbacks: "default"`), so a
  false-positive refusal falls back to another model instead of failing; the model that answered is
  recorded. `ANTHROPIC_EFFORT` is sent only to models that support it, so a budget model such as
  `ANTHROPIC_MODEL=claude-haiku-4-5` works without further settings.

## Chat assistant

The start page offers a chat assistant (`POST /api/chat`, NDJSON stream). It runs with
`AI_PROVIDER=anthropic` (or the scripted `mock` outside production) and can be switched off with
`CHAT_ENABLED=false`.

- The model calls KaufCheck's own functions as tools: listing check (with price check), marketplace
  search links, model knowledge, Kfz tax (with EU engine data), financing, the car advisor, the RDW
  check, input forms in the chat and buttons to app pages. Cards in the chat show the tool results;
  links in the model's text are only rendered for KaufCheck's own pages.
- The browser keeps the conversation (session storage of the tab) and sends it with each message;
  the server stores nothing of it, only daily counts (`ChatUsage`, deleted after seven days).
  Phone numbers, e-mail addresses and IBANs are removed before messages reach the model; the
  tools read the original. A message may be as long as a listing the check accepts (20,000
  characters).
- Limits: `CHAT_DAILY_FREE` (15) without an account or with a free one, `CHAT_DAILY_PRO` (150),
  `CHAT_DAILY_PER_ADDRESS` (60) per internet connection without Pro (stored as a keyed hash that
  changes daily, so dropping the cookie does not help), `CHAT_DAILY_TOTAL` (500) for all visitors
  together as a cost cap, `CHAT_RATE_PER_MINUTE` (10) per IP address. A message whose answer
  fails or shows nothing is not counted.
- Model: `CHAT_MODEL` (default `ANTHROPIC_MODEL`), `CHAT_EFFORT` (default `low`). Requests stream
  with adaptive thinking, a cached system prompt and conversation, and the server-side refusal
  fallback where the model supports it; the chat says when the fallback model answered. Tools with
  few optional fields use strict schemas; the API compiles at most 24 optional parameters across
  strict tools per request, which `chat-tools.test.ts` checks. Every tool validates its input.
- The server build bundles the catalog's JSON files (model knowledge, engine data) through an
  `import.meta.glob` plugin in `apps/api/scripts/build.mjs`.

## Stripe configuration

Without the three Stripe variables, KaufCheck shows „Pro – bald verfügbar“ and ordering answers
`PAYMENT_NOT_CONFIGURED`. Nothing is simulated. The server also refuses to start with Stripe but
without SMTP e-mail, `VAT_MODE` or the operator's name, address, e-mail and phone number.

1. Create a product with a monthly euro price in Stripe (no trial, tax behaviour „inclusive“ or
   unspecified) and set `STRIPE_PRICE_ID_PRO` and `STRIPE_SECRET_KEY`. The price shown on `/pro`,
   on the order page and in the confirmations is read from this price.
2. Add a webhook endpoint `https://<your-domain>/api/billing/webhook` for the events
   `checkout.session.completed`, `checkout.session.expired`, `customer.subscription.created`,
   `customer.subscription.updated` and `customer.subscription.deleted`; set its signing secret as
   `STRIPE_WEBHOOK_SECRET`.
3. Enable the Customer Portal (cancellation at period end, payment methods, invoices) and let
   failed subscription payments end the subscription after the last retry.

### How a Pro contract works (German consumer law)

- `/pro/bestellen` shows everything § 312j Abs. 2 BGB requires directly above the button
  „Zahlungspflichtig bestellen“; the order needs two consents (terms, immediate start with
  compensation on withdrawal, § 357a Abs. 2 BGB), stored with a timestamp and the terms version.
- The order is confirmed by e-mail at once (§ 312i BGB); payment follows in Stripe Checkout. When
  Stripe confirms the payment, the contract is concluded and confirmed by e-mail with the terms,
  the official withdrawal notice and the model withdrawal form (§ 312f BGB). Failed confirmations
  are retried (webhook retries, maintenance job).
- `/vertrag-kuendigen` („Verträge hier kündigen“, § 312k BGB) and `/vertrag-widerrufen`
  („Vertrag widerrufen“, § 356a BGB) work without signing in, show a receipt with date and time to
  save, and confirm by e-mail. Cancellations are passed to Stripe (at period end; later dates by the
  maintenance job); withdrawals of signed-in customers end the subscription at once. Everything the
  operator has to do by hand (refunds, unmatched notices) arrives as an e-mail.
- The texts live in `packages/shared/src/legal` so that pages and e-mails use the same wording.

The plan changes only from verified webhook events (signature checked, each event processed once).
`active`, `trialing` and `past_due` grant Pro. Deleting an account cancels its subscription. For
local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`.

## Google AdSense

- `ADSENSE_CLIENT` (ca-pub-…) alone serves `/ads.txt` and the `google-adsense-account` tag for the
  site verification. With `ADSENSE_SLOT` (a display ad unit), result pages and guides show one ad
  below the content – never with Pro, never when the browser sends Do Not Track or Global Privacy
  Control, and not on account, saved-listing or error pages.
- Consent comes from Google's certified consent dialog (AdSense → Privacy & messaging → European
  regulations message, with „Do not consent“ on the first layer). The footer button
  „Datenschutz- und Cookie-Einstellungen“ reopens it. Turn off „programmatic limited ads“ so that
  no ads (and no ad cookies) are served without consent – the privacy policy says so.
- Block the AdSense ad categories for loans and credit (blocking controls): result pages show a
  loan example (see Ads sold directly).
- While ads are on, HTML pages carry a nonce per response and the strict, nonce-based
  Content-Security-Policy Google supports (`'strict-dynamic'`); API responses keep the strict
  default policy.

## Ads sold directly

KaufCheck can sell its two ad placements itself (e.g. to a local dealer, an appraiser or a
workshop). `SPONSOR_ADS` is a JSON array, at most 20 entries:

```json
[
  {
    "id": "autohaus-muster-2026-11",
    "advertiser": "Autohaus Muster GmbH",
    "title": "Gebrauchtwagen in Musterstadt",
    "text": "Rund 100 Fahrzeuge vor Ort, Probefahrt nach Termin.",
    "url": "https://autohaus-muster.example/gebrauchtwagen",
    "image": "/sponsors/autohaus-muster.webp",
    "imageAlt": "Autohaus Muster: Hof mit Gebrauchtwagen",
    "placements": ["result_bottom", "guide_bottom"],
    "from": "2026-11-01",
    "until": "2026-11-30"
  }
]
```

- **Fields:**
  - `id`: lowercase letters, digits and single hyphens, at most 40 characters, unique.
  - `advertiser`: shown as „Werbung von …“. Use the name from the advertiser's imprint,
    including the legal form (§ 6 Abs. 1 Nr. 2 DDG).
  - `title` (at most 80 characters) and `url` (`https://`, used as given) are required.
  - `text` (at most 200 characters), the image and `from`/`until` are optional. `from`/`until`
    are German calendar days, both included.
- **The image** is a file of this site, lowercase `.png`, `.jpg`/`.jpeg` or `.webp`, under
  `apps/web/public/sponsors/`. It is shown in 4:1 format, e.g. 1200 × 300 px; `imageAlt`
  describes it. Images from other hosts are refused, so the advertiser never sees a visitor
  before a click. A new image needs a deploy. Remove it when the campaign ends.
- **Display:**
  - The browser asks `/api/sponsor-ads/<placement>` for an ad; the server picks one of the
    running ads.
  - The ad shows instead of AdSense, never with Pro, in a tinted, dashed box with „Werbung von
    …“ and the note that it is no recommendation and has no influence on checks and guides.
  - Ads are never chosen by the listing, its brand, region or seller.
  - No ads for loans or credit comparisons: the check shows a loan example, and an ad next to
    it would make it loan advertising (§ 17 PAngV).
  - While `SPONSOR_ADS` is set, the privacy policy has the section „Anzeigen von
    Werbepartnern“.
- **Counting** happens only on the server, in `SponsorAdStat`, per campaign and German day:
  - every delivery of an ad and every click through `/go/<id>`, which redirects to `url`;
  - no IP address, identifier or cookie, nothing measured in the browser, and nothing counted
    with Do Not Track / Global Privacy Control;
  - in development, React's StrictMode asks twice per page view, so local figures are doubled;
  - a delivery is not a view (the ad sits below the content), and bots can be counted too: report
    „Auslieferungen“, never „Sichtkontakte“, and sell placements for a fixed price per period. In
    the contract: „Gezählt werden Auslieferungen der Anzeige, nicht Sichtkontakte; ohne Besucher
    mit Do Not Track/GPC und mit Pro; automatisierte Zugriffe sind nicht ausgeschlossen.“

  ```sql
  SELECT campaign, sum(deliveries) AS deliveries, sum(clicks) AS clicks FROM "SponsorAdStat"
  WHERE day BETWEEN '2026-11-01' AND '2026-11-30' GROUP BY campaign ORDER BY campaign;
  ```

- **Check every ad before it goes live:**
  - no unproven claims such as „geprüft“, „empfohlen“ or „Testsieger“ (§ 5 UWG);
  - never the KaufCheck name or logo, and nothing that looks like a KaufCheck verdict;
  - nothing the guides warn about (Vorkasse, Treuhand, delivery from abroad), and no insurance
    or credit offers (§ 34d/§ 34c GewO, see the affiliate link).
- **Agree in writing** (text form is enough) on:
  - placement, period and a fixed price;
  - that the advertiser has no influence on checks, guides or rules;
  - that the advertiser is responsible for lawful content, image and trademark rights and its
    landing page (imprint, privacy), and releases KaufCheck from claims;
  - that KaufCheck approves the ad, may reject or remove it, and reports totals per campaign
    only;
  - no exclusivity unless agreed, and termination.
- **Tax:** ad revenue counts towards the small-business limits of § 19 UStG together with Pro
  (25,000 € in the previous year, 100,000 € in the current year). Invoices (§ 34a UStDV) name both
  parties with full address, the Steuernummer, the date, the service (placement and period) and
  the amount, with „Steuerfrei nach § 19 UStG (Kleinunternehmerregelung).“; an ordinary PDF is
  enough. For income tax and trade questions, ask a tax adviser.

## Affiliate link

- With `AFFILIATE_CAR_INSURANCE_URL` (an `https://` partner link, at most 1,000 characters, used
  exactly as given) and `AFFILIATE_CAR_INSURANCE_NAME` (the partner whose site the link opens, at
  most 100 characters, e.g. „Tarifcheck.de“), three guides show a link „Kfz-Versicherungen bei …
  vergleichen*“ to visitors without Pro: at the end of the budget section (buying guide), after
  the fees (registration) and after the saving tips (monthly costs). It is labelled „Werbung“ and
  explained as an affiliate link; the privacy policy gets a section „Affiliate-Links“.
- It is a plain link (`rel="sponsored noopener"`): no partner script, pixel or banner is loaded,
  and nothing is handed over. KaufCheck only points to the general comparison and names no
  insurers, prices or recommendations, so it stays a „Tippgeber“ without a licence under § 34d
  GewO. Do not change the text into advice, rankings or a pre-filled form, and do not place it
  next to warnings, legal duties or step-by-step instructions.
- Partner terms (https://www.tarifcheck-partnerprogramm.de/agb/, read on 17.10.2026): the
  Tarifcheck partner program (TARIFCHECK24 GmbH) allows only its own
  advertising material, unchanged, and names a contract penalty of 1,500 € per violation. Use the
  Kfz-Direktlink from the partner account unchanged, and get the link text and the name approved
  in writing by the partner support before setting the variables.
- The same way, `AFFILIATE_VEHICLE_HISTORY_URL` and `AFFILIATE_VEHICLE_HISTORY_NAME` (e.g.
  „carVertical“) show „Kostenpflichtigen Bericht zur Fahrzeughistorie bei … abrufen*“ in a check
  (between the checklist and the negotiation section, never inside the recall check with its
  official steps and warnings) and in the checklist guide, with the note that a report only holds
  what the provider's sources recorded. No VIN or other data goes to the partner; the visitor
  enters the VIN there.
- Partner terms of carVertical (https://www.carvertical.com/de/affiliate-program-terms, read on
  23.10.2026): own links and creatives only as provided (4.1, 5.4), disclosure on every page
  (5.6), no rebates from the commission (4.3) and no disparaging statements about carVertical
  (5.13); Lithuanian law (13.1). Before setting the variables, get the link text and the note
  above approved in writing by the affiliate team. Removing the variables removes both links at
  once, as the terms ask within 7 days after the end (9.2); a placement change carVertical asks for
  (5.7, within 30 days) needs a code change.

## Dutch registration lookup (RDW)

`/auto-aus-den-niederlanden` asks RDW Open Data (opendata.rdw.nl, public domain) for a Dutch
registration number: registration dates, export and taxi flags, the RDW's odometer verdict with its
explanation (translated close to the Dutch original), recalls and the defects and advice points of
the APK (the open data keeps about the last three years, a window that moves on; gas systems and
tachographs are left out).

- The browser sends the plate to `POST /api/rdw` (in the body, so that no URL log holds it); the
  server asks five datasets of the RDW, with a timeout of 8 seconds, and keeps an answer in memory
  for an hour (at most 500). The same plate asked at once goes out once. Nothing is stored in the
  database. 10 lookups per minute per client and `RDW_LOOKUPS_PER_MINUTE` (default 60) for the
  whole server; beyond that the answer is 429.
- `RDW_LOOKUP_MODE`: `live` (default), `off` (the lookup answers that it is switched off) or
  `fixtures` (synthetic answers from `apps/api/fixtures/rdw`, the default in tests, refused in
  production).
- `RDW_APP_TOKEN` (optional): a free Socrata app token against throttling, sent as `X-App-Token`.
  Without it the RDW's API throttles shared IP addresses sooner; KaufCheck then answers „not
  reachable“.
- An exported car stays in the open data only for a while; the page and the „not found“ message
  say so.

## Analytics configuration

First-party and cookieless: only an event name, a timestamp and a few allowlisted properties
(`source`, `errorCode`, `placement`, `count`, `plan`, `aiStatus`, `path`) are stored – no user
ids, IP addresses or free text. The browser sends nothing when „Do Not Track“ or „Global Privacy
Control“ is set. Events: `landing_page_view`, `listing_analysis_started`, `listing_analysis_completed`,
`listing_analysis_failed` (recorded by the server), `seller_questions_copied`,
`seller_message_created`, `checklist_started`, `listing_saved`, `search_saved`, `comparison_created`,
`pro_clicked`, `car_search_started`, `platform_search_opened`, `recall_check_opened`, `analysis_pdf_downloaded`, `negotiation_message_copied`, `owned_car_added`, `sale_contract_created`, `listing_text_created`, `service_history_pdf_downloaded`, `reminder_enabled`, `affiliate_clicked`.
Disable with `ANALYTICS_ENABLED=false`. Events are kept for 400 days, for example:

```sql
SELECT name, date_trunc('day', "createdAt") AS day, count(*) FROM "AnalyticsEvent" GROUP BY 1, 2 ORDER BY 2 DESC;
```

## Architecture

```
packages/shared   contracts used by web and API: Zod schemas, error codes, labels, plans, URL recognition
packages/catalog  car models (search list, researched knowledge in data/models, one chunk per model)
                  and the links to the marketplaces' own search pages
packages/domain   business rules: HTML and text parsing, normalization, category detection,
                  the vehicle analyzer (rules), AI prompts and output validation, comparison
apps/api          Fastify 5 + Prisma: pipeline, retrieval, AI providers, auth, quotas, billing, analytics
apps/web          React 19 + React Router + TanStack Query: UI only, prerendered static pages
e2e               Playwright end-to-end tests
```

The analysis pipeline (`apps/api/src/application/analysis-service.ts`) reports each stage when it
really starts and ends, streamed as NDJSON: **validate** (URL recognition, quota reservation) →
**retrieve** (fixture, live with robots.txt, or pasted text) → **extract** (parse, redact contact
data, detect the category) → **analyze** (rules, verified comparables) → **questions** (seller
questions, checklist) → **ai** (only when a provider is configured) → persist. If the client
disconnects, the pipeline is aborted and nothing is stored; failed analyses do not count against
the quota.

Business logic lives in `packages/domain`; the web app only renders results. New categories are
added by implementing a `StagedListingAnalyzer` (`packages/domain/src/analysis/types.ts`),
registering it in `analysis/registry.ts` and extending `detectCategory`; the categories are
already reserved in the contracts and the database.

## Security

- **SSRF**: only `https` URLs on an explicit host allowlist (no credentials, no custom ports); all
  DNS answers must be public (loopback, private, link-local incl. cloud metadata, CGNAT, multicast,
  documentation and IPv6 transition ranges are blocked, fail-closed), and the connection is pinned
  to the vetted address; redirects are re-validated (max. 3); overall deadline, byte limit on the
  decompressed body and content-type allowlist. The server cannot be used as an open proxy.
- **Retrieval etiquette**: robots.txt per RFC 9309 (unreachable = disallowed), an honest
  User-Agent linking to `/bot`, a global outbound rate limit, short caching and no retries around
  blocks.
- **Web**: CSRF protection via `Origin`/`Sec-Fetch-Site` for state-changing requests, JSON-only
  bodies (forms are rejected), 128 KB body limit, per-IP rate limits, strict CSP, `nosniff`,
  frame blocking, Permissions-Policy, no stack traces in responses, request ids.
- **Accounts**: scrypt password hashes, timing-equalized logins, session tokens stored as SHA-256
  (httpOnly, SameSite=Lax, Secure over HTTPS), single-use reset links valid for one hour, sign-out
  everywhere after a reset, signed anonymous id created only when an analysis starts.
- **Data**: phone numbers, e-mail addresses and IBANs are removed from listings before storage and
  before AI calls; logs contain operation, duration, status and error category – never cookies,
  tokens, keys, IP addresses or listing texts. Secrets come only from the environment.
- `npm audit` reports no known vulnerabilities (checked 15 October 2026). Vulnerable transitive
  Prisma CLI dependencies are overridden in `package.json`; others are updated in the lockfile with
  `npm audit fix` – check again before each release.

## Legal

- **Car search:** KaufCheck only links to the marketplaces' own result pages with the visitor's
  filters (`packages/catalog/src/platform-links.ts`) and never loads, stores or shows their
  results. Linking to publicly accessible pages, deep links included, is lawful (BGH, judgment of
  17 July 2003, I ZR 259/00 "Paperboy"). Showing the platforms' results inside KaufCheck would need
  a licence: a dedicated meta search engine that queries a car-ad database in real time
  re-utilises it (CJEU, judgment of 19 December 2013, C-202/12 "Innoweb"), and the platforms'
  terms and robots.txt forbid automated searches. The search parameters stay in KaufCheck's own
  URL; request logs never contain query strings.
- **Model knowledge** (`packages/catalog/data/models`): every known weakness carries at least one
  source (enforced by `src/catalog.test.ts`). The pages say that weaknesses do not occur in every
  car and that only an inspection shows the state of the car at hand.

- KaufCheck is independent and not affiliated with any marketplace (mobile.de, AutoScout24,
  Kleinanzeigen, eBay, Autohero, pkw.de, Facebook Marketplace); their names are only used to say
  where a listing comes from. (heycar was shut down in 2025 and is no longer recognized.)
- Links of all these marketplaces are recognized (`packages/shared/src/url.ts`) but only kept for
  reference: their terms forbid automated access without consent (mobile.de AGB § 11 and
  robots.txt `Disallow: /fahrzeuge/details.html`; AutoScout24 Verbraucher-AGB § 8.2 and
  `Disallow: /angebote/`; eBay User Agreement, Buy APIs only for approved eBay Partner Network
  partners; Autohero Nutzungsbedingungen § 4, written consent required; pkw.de AGB für Nutzer § 12,
  January 2025, express consent required; Meta terms, automated collection only with prior
  permission). A link leads to the text page; the text parser understands the page layouts of all
  of them. A platform is retrieved only if its retriever lists it in `platforms`.
- Automatic retrieval is **off by default in production** and must stay off for Kleinanzeigen: its
  terms of use (§ 5, version of 17 February 2024) forbid crawlers, spiders, scrapers or other
  automated mechanisms without Kleinanzeigen's express written consent. Enable
  `LISTING_FETCH_MODE=live` only with such consent; even then KaufCheck fetches only single pages a
  user asked for, respects robots.txt and never bypasses CAPTCHAs, logins or blocks. Without
  retrieval the homepage asks for the listing text, and a pasted link leads to the text page.
- The fixtures are synthetic and not real listings.
- `/datenschutz` follows the configuration: sections for optional features (AI, payments, ads,
  e-mail, retrieval, analytics) appear only when they are active, and on Render the hosting
  section names Render, its data processing agreement and its sub-processors. Other hosts get a
  generic hosting paragraph – extend `PrivacyPage` for them. Have the text reviewed before going
  live. `/impressum` needs the `VITE_IMPRINT_*` values.
- With AI enabled, listing texts (and for Pro, photos) are sent to the chosen AI provider, possibly
  outside the EU – mention this in the privacy policy and conclude the necessary agreements.
- KaufCheck gives no purchase advice and does not verify listing data; the UI and every analysis
  say so.

## Roadmap

- Further categories (electronics, bikes, …) using the reserved category contracts.
- Official data sources or partner APIs instead of page retrieval; a browser extension that
  imports the listing the user is viewing.
- Richer market context as more verified comparables accumulate.
- Alerts for saved searches and price-change notifications for saved listings (both need licensed
  listing data – KaufCheck does not query the marketplaces itself).
- Integration of a privacy-friendly ad network behind the existing `AdSlot` abstraction.
