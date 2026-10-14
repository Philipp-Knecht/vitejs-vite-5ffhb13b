# KaufCheck – Projektkontext

Stand: 13.10.2026. Grundlage sind das Repository (Branch `claude/kaufcheck-complete-app-6yabal`, Commit
`bd7ff04` auf `main` `b139fc2`) und der bisherige Entwicklungsverlauf mit Claude. Ausführliche technische
Details stehen im [README.md](README.md) (Englisch); dieses Dokument fasst sie auf Deutsch zusammen und
ergänzt, was nur aus dem Verlauf bekannt ist.

> Unbekannte Punkte sind mit **(unbekannt)** markiert. Zugangsdaten stehen hier bewusst nicht; sie liegen
> ausschließlich in den Umgebungsvariablen bei Render.

## 1. Zweck und Funktionsumfang

**KaufCheck – „Gebraucht kaufen. Besser entscheiden.“** ist eine deutschsprachige Web-App für den
Gebrauchtwagenkauf in Deutschland. Live unter **https://kaufcheck-app.de** (auch
`kaufcheck.onrender.com`, leitet für Seiten per 301 auf die Domain um).

Drei Säulen:

| Säule           | Funktion                                                                                                                                                                                                                                                                                                                    | Route(n)                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Finden**      | Eine Suchmaske für alle großen Börsen. KaufCheck baut daraus Links auf die **eigenen Ergebnisseiten** von mobile.de, AutoScout24, Kleinanzeigen, Autohero usw.; Ergebnisse werden nie selbst geladen. Dazu Modellwissen zum gesuchten Modell.                                                                               | `/auto-finden`                                      |
|                 | **Auto-Berater**: 7 Fragen (Budget, Nutzung, Personen, Getriebe, Prioritäten …) → Punktesystem über die recherchierten Modelle → Vorschläge mit passender Generation und Such-Link. Wird erst ab 40 recherchierten Modellen verlinkt/indexiert (seit PR #14 live).                                                          | `/auto-berater`                                     |
|                 | **Modellseiten** (vorgerendert, SEO): Generationen, Stärken, Schwachstellen mit Quellen, Motoren, Besichtigungstipps, Zuverlässigkeitsnote.                                                                                                                                                                                 | `/modelle`, `/modelle/:id`                          |
| **Prüfen**      | Inseratstext (oder Link) einfügen → regelbasierte Analyse: Angaben mit Herkunft (_Aus dem Inserat_, _Berechnet_, _Vermutung_, _Nicht bekannt_), fehlende Angaben, Auffälligkeiten, Fragen an den Verkäufer, Besichtigungs-Checkliste, Preisrechnungen, bekannte Schwachstellen der Modellgeneration. Optional KI-Ergänzung. | `/inserat-pruefen`, `/inseratstext`, `/analyse/:id` |
| **Entscheiden** | Angebote speichern, vergleichen, Reihenfolge nach eigenen Prioritäten („Deine Reihenfolge“), Verlauf (Pro).                                                                                                                                                                                                                 | `/meine-angebote`, `/vergleich`, `/verlauf`         |

Weitere Seiten: Ratgeber (`/gebrauchtwagen-kaufen`, `/gebrauchtwagen-checkliste`,
`/auto-besichtigung-checkliste`), `/pro`, `/pro/bestellen`, `/pro/bestellt`, Konto (`/anmelden`,
`/registrieren`, `/konto`, `/passwort-vergessen`, `/passwort-zuruecksetzen`), Recht (`/impressum`,
`/datenschutz`, `/agb`, `/widerrufsbelehrung`, `/vertrag-kuendigen`, `/vertrag-widerrufen`), `/bot`
(Beschreibung des User-Agents).

**Pläne** (Standardwerte, `packages/shared/src/plans.ts` bzw. Umgebungsvariablen):

| Plan               | Prüfungen/Monat | Gespeicherte Angebote | Vergleich | Gespeicherte Suchen | Sonstiges                                                 |
| ------------------ | --------------- | --------------------- | --------- | ------------------- | --------------------------------------------------------- |
| Ohne Konto         | 3               | –                     | –         | –                   | Werbung                                                   |
| Kostenlos          | 10              | 5                     | 3         | –                   | Werbung                                                   |
| Pro (4,99 €/Monat) | 300             | 500                   | 6         | 50                  | Verlauf, Foto-Analyse (nur mit Link-Abruf), keine Werbung |

Grundsätze (vom Nutzer vorgegeben, im Code umgesetzt): keine erfundenen Daten, keine Kaufempfehlung,
keine Umgehung technischer Schutzmaßnahmen, kein Scraping von Marktplätzen, UI auf Deutsch, Code und
README auf Englisch.

## 2. Tech-Stack und Architektur

- **Monorepo** mit npm-Workspaces, Node.js 22 (`.nvmrc`), TypeScript, ESLint (type-aware, React-Compiler-Regeln), Prettier.
- **Web** (`apps/web`): React 19, React Router, TanStack Query, Vite 8 (rolldown). Statische Seiten werden beim Build vorgerendert (`apps/web/src/entry-server.tsx`, `apps/web/scripts/prerender.mjs`) und im Browser hydriert. Modellseiten bekommen ihre Daten als `<script id="page-data">`.
- **API** (`apps/api`): Fastify 5, Prisma 7 (Adapter `@prisma/adapter-pg`), PostgreSQL 16, Zod 4. Gebündelt mit esbuild zu `apps/api/dist/server.js`. Liefert in Produktion auch die Web-App aus (gleiche Origin).
- **Pakete**:
  - `packages/shared`: Zod-Schemas/Verträge, Fehlercodes, Pläne, URL-Erkennung, Rechtstexte (`src/legal`), Vergleichs-Ranking.
  - `packages/domain`: Geschäftslogik – Parser (HTML/Text), Normalisierung, Regel-Analyse, KI-Prompts und -Validierung, Vergleich.
  - `packages/catalog`: Marken/Modelle für die Suche, Link-Builder zu den Börsen, Modellwissen (JSON je Modell), Auto-Berater.
- **Tests**: Vitest (Unit + Integration gegen PostgreSQL), Playwright (E2E, Chromium) inkl. axe-Barrierefreiheit.
- **Betrieb**: Docker (Multi-Stage), Render Blueprint (`render.yaml`, Frankfurt, Web-Service + PostgreSQL), GitHub Actions CI (`.github/workflows`: Job `check` = Format, Lint, Typecheck, Unit, Integration, Build, Playwright; Job `docker` = Image-Build).

Analyse-Pipeline (`apps/api/src/application/analysis-service.ts`), als NDJSON gestreamt:
validate → retrieve → extract (inkl. Entfernen von Kontaktdaten) → analyze (Regeln) → questions → ai (optional) → speichern.

## 3. Projektstruktur und wichtige Dateien

```
apps/api/          Fastify-Server
  prisma/schema.prisma, prisma/migrations/   Datenmodell + 3 Migrationen
  src/app.ts                                  Plugins (Sicherheit, Rate-Limit, Routen)
  src/config/env.ts                           Validierung aller Umgebungsvariablen (verweigert unsichere Prod-Konfiguration)
  src/container.ts                            Dependency-Wiring
  src/application/*                           Services (Analyse, Auth, Konto, Usage, Verträge, gespeicherte Angebote/Suchen, Wartung)
  src/infrastructure/                         ai/, billing/ (Stripe), email/, listing-sources/, net/ (SSRF-sicherer Fetcher)
  src/http/routes/*                           HTTP-Routen; src/http/web.ts liefert die Web-App aus
  test/*                                      Integrationstests
  scripts/set-plan.ts                         Plan manuell setzen (npm run user:set-plan)
apps/web/          React-App
  src/App.tsx                                 Routen
  src/pages/*, src/features/*                 Seiten und Feature-Module (advisor, analysis, compare, contracts, models, result, saved, search …)
  src/features/advisor/availability.ts        ADVISOR_MIN_MODELS = 40 (Freischaltung des Beraters)
  src/seo/pages.ts                            Meta-Daten
packages/catalog/
  src/models.ts, src/makes.ts                 Suchkatalog (Marken, Modelle mit Segment)
  src/platform-links.ts                       Links auf die Ergebnisseiten der Börsen
  src/advisor.ts                              Berater-Punktesystem + Budget-Schätzung (newestAffordableYear)
  src/vehicle-match.ts                        Inserat → Katalogmodell (findMake, findListingModel)
  data/models/<id>.json                       Modellwissen, 53 Modelle (siehe data/models/README.md)
  data/index.json                             Kurzfassung für den Berater, erzeugt mit npm run catalog:index
packages/shared/src/comparison-ranking.ts     „Deine Reihenfolge“ im Vergleich
e2e/                                          Playwright-Tests
tools/model-research/                         Recherche-Werkzeuge für das Modellwissen (nicht Teil der App)
render.yaml, Dockerfile, docker-compose.yml   Deployment
```

## 4. Datenmodell, APIs, externe Dienste

**Prisma-Modelle** (`apps/api/prisma/schema.prisma`): `User`, `Session` (nur SHA-256 des Tokens),
`PasswordResetToken`, `Listing`, `Vehicle`, `Analysis`, `SellerQuestion`, `SavedListing`, `SavedSearch`,
`Usage`, `Subscription`, `Order`, `ContractNotice`, `BillingEvent` (Webhook-Idempotenz), `AnalyticsEvent`;
Enums `AccountPlan`, `ListingSourceType`, `ListingCategory`, `OrderStatus`, `ContractNoticeType`.
Migrationen: `20260930103053_init`, `20261001061746_pro_orders_and_contract_notices`, `20261007140000_saved_searches`.

**API-Routen** (alle unter `/api`): `health`, `config`, `events`, `me`, `account`, `auth/register|login|logout`,
`auth/password-reset/request|confirm`, `listings/analyze|analyze-text|analyze-example`, `analyses`,
`analyses/:id`, `saved-listings[/:id][/reanalyze]`, `comparisons`, `saved-searches[/:id]`,
`billing/orders[/:number]`, `billing/portal`, `billing/webhook`, `contracts/cancellations`,
`contracts/withdrawals`. Außerdem `/ads.txt`.

**Externe Dienste** (Stand laut Verlauf / Live-Prüfung am 08.10.2026):

| Dienst                    | Zweck                                                                     | Status                                                                                           |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Render                    | Hosting (Web-Service + PostgreSQL, Frankfurt), Auto-Deploy von `main`     | aktiv                                                                                            |
| Domain `kaufcheck-app.de` | eigene Domain                                                             | aktiv                                                                                            |
| Anthropic                 | KI-Ergänzung der Analyse (`AI_PROVIDER=anthropic`)                        | aktiv (`/api/config`: `aiProvider: anthropic`); verwendetes Modell: (unbekannt, steht in Render) |
| Brevo (SMTP)              | Passwort-Reset, Vertrags-E-Mails                                          | aktiv                                                                                            |
| Stripe                    | Pro-Abo 4,99 €/Monat, Kleinunternehmer (`VAT_MODE=small_business`), Karte | seit 08.10.2026 `billing: true`; **echter Testkauf/Webhook noch nicht bestätigt**                |
| Google AdSense            | Werbung                                                                   | Code fertig; Freigabe für `kaufcheck-app.de` (unbekannt). `onrender.com` wurde abgelehnt         |
| Link-Abruf von Inseraten  | `LISTING_FETCH_MODE`                                                      | in Produktion **aus** (`urlRetrieval: false`); nur mit schriftlicher Zustimmung der Plattform    |

## 5. Aktueller Entwicklungsstand

- `main` (`b139fc2`, PR #14) ist live: Suche, Prüfung, Vergleich mit Prioritäten, gespeicherte Suchen (Pro),
  43 Modelle mit Wissen, Auto-Berater freigeschaltet, Telefonnummer im Impressum, Stripe aktiv.
- Branch `claude/kaufcheck-complete-app-6yabal` enthält **einen noch nicht gemergten Commit** `bd7ff04`
  mit 10 weiteren Modellen (Kia Picanto/Rio/Ceed/Sportage, Audi A3/A4/A6/Q3, Seat Ibiza/Leon) → 53 Modelle.
  Lokal geprüft (Katalog-Tests grün, Quellen-URLs erreichbar); ein PR dafür existiert noch nicht.
- Bisherige PRs: #1–#14 (alle gemergt, Squash). Etappen: 1 = Katalog/Auto finden/Startseite (#11),
  2 = Berater + Modellseiten (#12), 3 = Modellwissen in der Prüfung, Entscheidungshilfe, gespeicherte Suchen (#13),
  Freischaltung Berater mit 43 Modellen (#14).
- Testlage beim letzten Lauf (08.10.2026): `npm run check` grün (400 Unit-Tests), 74 Integrationstests grün,
  38 E2E-Tests grün (1 übersprungen, weil der Berater verfügbar ist).
- Modellwissen-Recherche: Ziel ~100–125 Modelle; offen sind die Pakete A12–A21 (48 Modelle) und 38 jüngere
  Modelle ohne ADAC-Gebrauchtwageninfo (siehe [TODO.md](TODO.md)).
- Eine Betreiber-Anleitung („KaufCheck – Anleitung für die fehlenden Schritte“) liegt als Claude-Docs-Dokument
  im bisherigen Claude-Account; ob sie aus einem anderen Account erreichbar ist: (unbekannt). Inhalt u. a.:
  Render-Variablen, E-Mail/Brevo, Stripe-Einrichtung inkl. Fehlersuche, AdSense, Domain, E-Mail-Entwürfe an
  mobile.de, AutoScout24, Autohero und pkw.de zur Genehmigung des Link-Abrufs.
