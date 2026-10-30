import {
  buildPlatformLinks,
  defaultGeneration,
  EMPTY_SEARCH,
  findListingModel,
  findMake,
  generationYearsLabel,
  KBA_RECALL_DATABASE_URL,
  recallCheckFor,
  recommend,
  SEARCH_FIELD_LABELS,
  SEARCH_FUEL_LABELS,
  SEARCH_FUELS,
  SEARCH_TRANSMISSIONS,
  toSearchParams,
  USAGES,
  MILEAGES,
  PRIORITIES,
  type Generation,
  type SearchQuery,
} from '@kaufcheck/catalog';
import { MODEL_INDEX } from '@kaufcheck/catalog/advisor-index';
import {
  engineCo2,
  engineLabels,
  engineTaxDrive,
  enginesOfYear,
  engineYear,
  findIndexModel,
  loadEngineIndex,
  loadEngines,
} from '@kaufcheck/catalog/engines';
import { ALL_KNOWLEDGE } from '@kaufcheck/catalog/knowledge-eager';
import {
  AVERAGE_LOAN_RATE,
  CHAT_FORMS,
  financingProposal,
  formatDutchPlate,
  germanDay,
  normalizeDutchPlate,
  PRICE_VERDICT_LABELS,
  vehicleTax,
  type AnalysisDto,
  type ChatCard,
  type ChatForm as ChatFormKind,
  type ChatJump,
  type VehicleTaxResult,
} from '@kaufcheck/shared';
import { z } from 'zod';
import type { ChatToolSpec } from '../../infrastructure/ai/chat-model';
import { isAppError } from '../../lib/errors';
import type { Actor } from '../actor';
import type { AnalysisService } from '../analysis-service';
import type { RdwService } from '../rdw-service';

export interface ChatToolContext {
  actor: Actor;
  signal: AbortSignal;
  /** The visitor's latest message: a pasted listing is analysed from here, not from tool input. */
  latestUserText: string;
  now: Date;
}

export interface ChatToolOutcome {
  /** What the model reads. */
  content: string;
  isError?: boolean;
  card?: ChatCard;
  /** One line kept in the conversation for follow-up questions. */
  context?: string;
  /** Kept instead of the latest user message (a long pasted listing). */
  replaceUserMessage?: string;
  /** The page of KaufCheck to do this yourself, shown under the answer. */
  jump?: ChatJump;
}

export interface ChatTool {
  spec: ChatToolSpec;
  /** Shown while it runs, e.g. „Prüfe das Inserat“. */
  label: string;
  /** Runs at most once per message (a check costs one of the visitor's checks). */
  once?: boolean;
  run(input: unknown, ctx: ChatToolContext): Promise<ChatToolOutcome>;
}

export interface ChatToolDeps {
  analyses: AnalysisService;
  rdw: RdwService;
}

const euro = (value: number) =>
  `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })}\u00A0€`;

const fail = (content: string): ChatToolOutcome => ({ content, isError: true });

/** JSON Schema for strict tools: every object closed, optional fields left out of `required`. */
function objectSchema(
  properties: Record<string, Record<string, unknown>>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false };
}

const integer = (description: string) => ({ type: 'integer', description });
const number = (description: string) => ({ type: 'number', description });
const string = (description: string) => ({ type: 'string', description });
const oneOf = (values: readonly string[], description: string) => ({
  type: 'string',
  enum: [...values],
  description,
});

function tool<T>(
  spec: ChatToolSpec,
  label: string,
  input: z.ZodType<T>,
  run: (input: T, ctx: ChatToolContext) => Promise<ChatToolOutcome>,
): ChatTool {
  return {
    spec,
    label,
    run: async (raw, ctx) => {
      // Tool input streams unchecked: a truncated or wrong value never reaches the tool.
      const parsed = input.safeParse(raw);
      if (!parsed.success)
        return fail(
          `Ungültige Eingabe: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
        );
      return run(parsed.data, ctx);
    },
  };
}

// ---------------------------------------------------------------------------
// Listing check
// ---------------------------------------------------------------------------

function analysisOutcome(dto: AnalysisDto): ChatToolOutcome {
  const { analysis } = dto;
  const title = analysis.vehicleSummary?.title ?? dto.listing.title ?? 'Auto-Inserat';
  const price = analysis.priceContext.askingPrice?.display ?? null;
  const { market, advice } = analysis.priceContext;
  const verdict = market.status === 'available' ? (market.verdict ?? null) : null;
  const warnings = analysis.observations
    .filter((observation) => observation.severity !== 'info')
    .map((observation) => observation.title);
  const questions = analysis.sellerQuestions.slice(0, 5).map((question) => question.textInformal);
  const link = `/analyse/${dto.id}`;
  const lines = [
    `Prüfung gespeichert: ${link}`,
    `Auto: ${title}${price ? `, ${price}` : ''}`,
    `Preis-Check: ${verdict ? PRICE_VERDICT_LABELS[verdict] : 'keine Preisstufe'} – ${market.message}`,
    advice
      ? `Empfehlung zum Preis: ${advice.title}. ${advice.text}${advice.targetPriceEur ? ` Zielpreis: ${euro(advice.targetPriceEur)}.` : ''}`
      : 'Empfehlung zum Preis: keine (kein Preis im Inserat).',
    `Zusammenfassung: ${analysis.summary.text}`,
    `Auffälligkeiten: ${warnings.length > 0 ? warnings.join('; ') : 'keine Warnungen'}`,
    `Offen: ${analysis.summary.openPoints.map((point) => point.text).join('; ') || '–'}`,
    `Fragen an den Verkäufer: ${questions.join(' | ') || '–'}`,
    `Vollständigkeit der Angaben: ${analysis.completeness.score} %`,
  ];
  return {
    content: lines.join('\n'),
    card: {
      type: 'analysis',
      analysisId: dto.id,
      title,
      priceDisplay: price,
      verdict,
      advice: advice ?? null,
      warnings: warnings.slice(0, 5),
      questions: questions.slice(0, 3),
    },
    context: `Geprüftes Inserat ${link}: ${title}${price ? `, ${price}` : ''}; Preis-Check: ${
      verdict ? PRICE_VERDICT_LABELS[verdict] : 'keine Preisstufe'
    }${advice ? `; ${advice.title}` : ''}; Auffälligkeiten: ${warnings.slice(0, 4).join(', ') || 'keine'}`,
    replaceUserMessage: `[Inserat eingefügt: ${title}${price ? `, ${price}` : ''} – geprüft: ${link}]`,
    jump: { label: 'Ganze Prüfung öffnen', href: link },
  };
}

const analyzeListing = (deps: ChatToolDeps): ChatTool => ({
  once: true,
  ...tool(
    {
      name: 'analyze_listing',
      strict: true,
      description:
        'Prüft das Auto-Inserat, das in der letzten Nachricht des Nutzers steht (kopierter Text von mobile.de, AutoScout24, Kleinanzeigen usw.): Angaben, Widersprüche, Warnzeichen, Fragen an den Verkäufer und der Preis-Check mit Preisstufe und Empfehlung. Speichert die Prüfung und zählt als eine der Inseratsprüfungen des Nutzers. Nur aufrufen, wenn die letzte Nachricht einen Inseratstext enthält; der Text wird direkt aus der Nachricht genommen.',
      inputSchema: objectSchema({}),
    },
    'Prüfe das Inserat',
    z.object({}),
    async (_input, ctx) => {
      const text = ctx.latestUserText.trim();
      if (text.length < 120)
        return fail(
          'Die letzte Nachricht enthält keinen Inseratstext. Bitte den Nutzer, den ganzen Text des Inserats einzufügen (Link allein reicht nicht).',
        );
      try {
        const dto = await deps.analyses.run(
          { kind: 'text', text },
          { actor: ctx.actor, signal: ctx.signal },
        );
        return analysisOutcome(dto);
      } catch (error) {
        if (isAppError(error) && error.code !== 'INTERNAL_ERROR') return fail(error.message);
        throw error;
      }
    },
  ),
});

// ---------------------------------------------------------------------------
// Car search
// ---------------------------------------------------------------------------

const SearchInput = z.object({
  make: z.string().max(40).optional(),
  model: z.string().max(60).optional(),
  price_min: z.number().int().min(0).max(1_000_000).optional(),
  price_max: z.number().int().min(0).max(1_000_000).optional(),
  year_min: z.number().int().min(1950).max(2100).optional(),
  year_max: z.number().int().min(1950).max(2100).optional(),
  km_max: z.number().int().min(0).max(1_000_000).optional(),
  fuel: z.enum(SEARCH_FUELS).optional(),
  transmission: z.enum(SEARCH_TRANSMISSIONS).optional(),
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  radius_km: z.number().int().min(1).max(500).optional(),
});

function describeSearch(query: SearchQuery, makeName: string | null, modelName: string | null) {
  const parts = [
    [makeName, modelName].filter(Boolean).join(' ') || 'alle Marken',
    query.priceMax !== null ? `bis ${euro(query.priceMax)}` : null,
    query.priceMin !== null ? `ab ${euro(query.priceMin)}` : null,
    query.yearMin !== null ? `ab Erstzulassung ${query.yearMin}` : null,
    query.yearMax !== null ? `bis Erstzulassung ${query.yearMax}` : null,
    query.kmMax !== null ? `bis ${query.kmMax.toLocaleString('de-DE')}\u00A0km` : null,
    query.fuel ? SEARCH_FUEL_LABELS[query.fuel] : null,
    query.transmission === 'automatic'
      ? 'Automatik'
      : query.transmission === 'manual'
        ? 'Schaltgetriebe'
        : null,
    query.zip ? `bei ${query.zip}${query.radiusKm ? ` (${query.radiusKm}\u00A0km)` : ''}` : null,
  ];
  return parts.filter(Boolean).join(', ');
}

const searchCars = tool(
  {
    name: 'search_cars',
    strict: false,
    description:
      'Baut Suchlinks zu den Ergebnisseiten von mobile.de, AutoScout24, Kleinanzeigen, eBay, Autohero, pkw.de und Facebook mit den Wünschen des Nutzers. KaufCheck ruft die Börsen nie selbst ab: Der Nutzer öffnet die Links und sieht die Angebote dort. Nur Angaben setzen, die der Nutzer genannt hat.',
    inputSchema: objectSchema({
      make: string('Marke, z. B. „VW“'),
      model: string('Modell, z. B. „Golf“'),
      price_min: integer('Mindestpreis in Euro'),
      price_max: integer('Höchstpreis in Euro'),
      year_min: integer('Erstzulassung ab Jahr'),
      year_max: integer('Erstzulassung bis Jahr'),
      km_max: integer('Höchster Kilometerstand'),
      fuel: oneOf(SEARCH_FUELS, 'Kraftstoff'),
      transmission: oneOf(SEARCH_TRANSMISSIONS, 'Getriebe'),
      zip: string('Postleitzahl, fünf Ziffern'),
      radius_km: integer('Umkreis um die Postleitzahl in km'),
    }),
  },
  'Baue die Suche',
  SearchInput,
  (input) => {
    if (input.model && !input.make)
      return Promise.resolve(
        fail('Zum Modell fehlt die Marke: gib make mit an (z. B. make „VW“, model „Golf“).'),
      );
    const make = input.make ? findMake(input.make) : null;
    if (input.make && !make)
      return Promise.resolve(fail(`Die Marke „${input.make}“ kennt KaufCheck nicht.`));
    const model = make && input.model ? findListingModel(make, input.model) : null;
    const query: SearchQuery = {
      ...EMPTY_SEARCH,
      makeId: make?.id ?? null,
      modelId: model?.id ?? null,
      modelText: make && input.model && !model ? input.model : null,
      priceMin: input.price_min ?? null,
      priceMax: input.price_max ?? null,
      yearMin: input.year_min ?? null,
      yearMax: input.year_max ?? null,
      kmMax: input.km_max ?? null,
      fuel: input.fuel ?? null,
      transmission: input.transmission ?? null,
      zip: input.zip ?? null,
      radiusKm: input.zip ? (input.radius_km ?? null) : null,
    };
    const links = buildPlatformLinks(query, {
      make,
      model,
      modelText: query.modelText,
    });
    const summary = describeSearch(query, make?.name ?? null, model?.model ?? input.model ?? null);
    const findUrl = `/auto-finden?${toSearchParams(query).toString()}`;
    return Promise.resolve({
      content: [
        `Suche: ${summary}`,
        `KaufCheck-Suchseite: ${findUrl}`,
        ...links.map(
          (link) =>
            `${link.name}: übernimmt ${link.applied.map((field) => SEARCH_FIELD_LABELS[field]).join(', ') || 'keine Filter'}`,
        ),
      ].join('\n'),
      card: {
        type: 'search',
        summary,
        findUrl,
        links: links.map((link) => ({
          name: link.name,
          url: link.url,
          applied: link.applied.map((field) => SEARCH_FIELD_LABELS[field]),
        })),
      },
      context: `Suche erstellt: ${summary} (${findUrl})`,
      jump: { label: 'Suche bei KaufCheck anpassen', href: findUrl },
    });
  },
);

// ---------------------------------------------------------------------------
// Model knowledge
// ---------------------------------------------------------------------------

const modelInfo = tool(
  {
    name: 'model_info',
    strict: true,
    description:
      'Recherchiertes Wissen von KaufCheck zu einem Modell: Generationen, bekannte Schwachstellen mit Prüftipp (aus ADAC-Pannenstatistik, TÜV-Report, Rückrufen, Fachpresse), Tipps für die Besichtigung, Bewertungen und wo man Rückrufe prüft. Nur dieses Wissen weitergeben, nichts dazuerfinden.',
    inputSchema: objectSchema(
      {
        make: string('Marke'),
        model: string('Modell'),
        year: integer('Erstzulassungsjahr, wenn bekannt'),
      },
      ['make', 'model'],
    ),
  },
  'Schlage das Modell nach',
  z.object({
    make: z.string().min(1).max(40),
    model: z.string().min(1).max(60),
    year: z.number().int().min(1950).max(2100).optional(),
  }),
  (input, ctx) => {
    const make = findMake(input.make);
    const entry = make ? findListingModel(make, input.model) : null;
    const knowledge = entry ? ALL_KNOWLEDGE.find((model) => model.id === entry.id) : undefined;
    const recall = make ? recallCheckFor(make.id) : null;
    const recallLine = `Rückrufe: FIN über ${recall ? `${recall.url} (Hersteller) oder ` : ''}die Rückrufdatenbank des KBA ${KBA_RECALL_DATABASE_URL} prüfen; Ratgeber: /auto-rueckruf-pruefen`;
    if (!knowledge) {
      return Promise.resolve({
        content: `Zu ${input.make} ${input.model} hat KaufCheck kein recherchiertes Modellwissen. Keine Schwachstellen nennen, die nicht belegt sind. Übersicht der Modelle: /modelle\n${recallLine}`,
        context: `Modellwissen: keins zu ${input.make} ${input.model}`,
        jump: { label: 'Alle Modelle und Schwachstellen', href: '/modelle' },
      });
    }
    const year = input.year ?? null;
    // In a changeover year both generations were sold: show both and let the user confirm.
    const current = ctx.now.getUTCFullYear();
    const inYear =
      year === null
        ? []
        : knowledge.generations.filter(
            (item) => item.years[0] <= year && year <= (item.years[1] ?? current),
          );
    const fallback = defaultGeneration(knowledge, year, year);
    const generations = inYear.length > 1 ? inYear : fallback ? [fallback] : [];
    const url = `/modelle/${knowledge.id}`;
    const name = `${knowledge.make} ${knowledge.model}`;
    const label = (item: Generation) => `${item.name} (${generationYearsLabel(item.years)})`;
    const several = generations.length > 1;
    const confirm =
      year === null
        ? ' – Erstzulassung unbekannt, Generation bitte bestätigen lassen'
        : several
          ? ` – ${year} wurden beide gebaut, Generation bitte bestätigen lassen`
          : '';
    const lines = [
      `Modell: ${name} (Seite: ${url})`,
      generations.length > 0
        ? `Generation: ${generations.map(label).join(' oder ')}${confirm}`
        : 'Keine passende Generation.',
      `Bewertungen (1–5): Zuverlässigkeit ${knowledge.ratings.reliability}, Unterhalt ${knowledge.ratings.runningCosts}, Platz ${knowledge.ratings.space}, Komfort ${knowledge.ratings.comfort}`,
      ...generations.flatMap((item) => [
        ...item.issues.map(
          (issue) =>
            `Schwachstelle${several ? ` ${item.name}` : ''} (${issue.severity}): ${issue.title}. Betrifft: ${issue.affects}. ${issue.detail} Prüfen: ${issue.check} Quellen: ${issue.sources.map((source) => source.label).join(', ')}`,
        ),
        ...(item.issues.length === 0
          ? [`Für ${item.name} sind keine Schwachstellen mit Quelle erfasst.`]
          : []),
        ...item.tips.map((tip) => `Tipp${several ? ` ${item.name}` : ''}: ${tip}`),
      ]),
      'Nicht jedes Auto ist betroffen; den Zustand zeigt erst die Besichtigung.',
      recallLine,
    ];
    const issues = generations.flatMap((item) =>
      item.issues.map((issue) => ({
        title: several ? `${item.name}: ${issue.title}` : issue.title,
        severity: issue.severity,
      })),
    );
    return Promise.resolve({
      content: lines.join('\n'),
      card: {
        type: 'model',
        modelId: knowledge.id,
        name,
        generation: generations.length > 0 ? generations.map(label).join(' oder ') : null,
        issues,
        url,
      },
      context: `Modellwissen ${name} ${generations.map((item) => item.name).join(' oder ')}: ${issues.map((issue) => issue.title).join(', ') || 'keine Schwachstellen erfasst'} (${url})`,
      jump: { label: 'Alle Schwachstellen mit Quellen', href: url },
    });
  },
);

// ---------------------------------------------------------------------------
// Tax
// ---------------------------------------------------------------------------

const TaxInput = z.object({
  first_registration: z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/),
  drive: z.enum(['petrol', 'diesel', 'electric']),
  displacement_ccm: z.number().int().min(1).max(10_000).optional(),
  co2_g_per_km: z.number().min(0).max(1000).optional(),
  gross_weight_kg: z.number().int().min(1).max(10_000).optional(),
  make: z.string().max(40).optional(),
  model: z.string().max(60).optional(),
  power_kw: z.number().int().min(1).max(2000).optional(),
});

const DRIVE_LABELS = { petrol: 'Benzin (Fremdzündung)', diesel: 'Diesel', electric: 'Elektro' };

const germanDate = (day: string) => day.split('-').reverse().join('.');

/** The same tax for every day of the month: a month-only registration is enough. */
function sameTax(a: VehicleTaxResult, b: VehicleTaxResult): boolean {
  if (a.kind === 'amount' && b.kind === 'amount')
    return a.annualEur === b.annualEur && a.rule === b.rule;
  if (a.kind === 'exempt' && b.kind === 'exempt')
    return a.rule === b.rule && a.afterwardsEur === b.afterwardsEur;
  return a.kind === b.kind;
}

function lastDayOfMonth(month: string): string {
  const [year = 0, number = 1] = month.split('-').map(Number);
  const day = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

async function engineValues(
  input: z.infer<typeof TaxInput>,
  firstRegistration: string,
  now: Date,
): Promise<{ ccm: number | null; co2: number | null; note: string } | string | null> {
  const make = input.make ? findMake(input.make) : null;
  if (!make || !input.model) return null;
  const index = await loadEngineIndex();
  const listed = findListingModel(make, input.model);
  const found = findIndexModel(index, make.id, listed?.id ?? input.model);
  const file = found ? await loadEngines(found.modelId) : null;
  if (!file) return null;
  const year = engineYear(file.engines, firstRegistration, now.getUTCFullYear());
  if (year === null) return null;
  const candidates = enginesOfYear(file.engines, year).filter(
    (engine) =>
      engineTaxDrive(engine.fuel) === input.drive &&
      (input.power_kw === undefined || Math.abs(engine.kw - input.power_kw) <= 2) &&
      (input.displacement_ccm === undefined ||
        engine.ccm === null ||
        Math.abs(engine.ccm - input.displacement_ccm) <= 50),
  );
  if (candidates.length === 1) {
    const engine = candidates[0]!;
    return {
      ccm: engine.ccm,
      co2: engineCo2(engine, firstRegistration),
      note: `Hubraum und CO₂ aus den EU-Daten (Median der Neuzulassungen ${year}, EEA); verbindlich ist der Fahrzeugschein.`,
    };
  }
  if (candidates.length === 0) return null;
  const labels = engineLabels(candidates);
  return `Mehrere Motoren möglich (${year}): ${candidates
    .slice(0, 8)
    .map((engine) => labels.get(`${engine.fuel}|${engine.ccm ?? ''}|${engine.kw}`))
    .join(
      '; ',
    )}. Frag, welcher Motor es ist, oder zeig das Formular „tax“ – dort wählt der Nutzer Modell und Motor aus der Liste; dann ruf das Werkzeug mit power_kw erneut auf.`;
}

const vehicleTaxTool = tool(
  {
    name: 'vehicle_tax',
    strict: true,
    description:
      'Rechnet die jährliche Kfz-Steuer nach KraftStG. Braucht die Erstzulassung und den Antrieb (petrol gilt für Benzin, Autogas, Erdgas und Benzin-Hybride). Hubraum und CO₂ kommen aus den EU-Motordaten (Marke, Modell, Leistung) oder aus dem Fahrzeugschein (P.1 und V.7). Fehlt der Motor, zeig lieber das Formular „tax“ mit der Motorliste, statt nach Hubraum, CO₂ oder kW zu fragen. Nie Werte raten.',
    inputSchema: objectSchema(
      {
        first_registration: string('Erstzulassung als YYYY-MM-DD oder YYYY-MM'),
        drive: oneOf(['petrol', 'diesel', 'electric'], 'Antrieb für die Steuer'),
        displacement_ccm: integer('Hubraum in cm³ (Fahrzeugschein P.1)'),
        co2_g_per_km: number('CO₂ in g/km (Fahrzeugschein V.7)'),
        gross_weight_kg: integer('Zulässige Gesamtmasse in kg (F.2), nur bei Elektroautos'),
        make: string('Marke, um Hubraum und CO₂ nachzuschlagen'),
        model: string('Modell, um Hubraum und CO₂ nachzuschlagen'),
        power_kw: integer('Leistung in kW, um den Motor zu bestimmen'),
      },
      ['first_registration', 'drive'],
    ),
  },
  'Rechne die Kfz-Steuer',
  TaxInput,
  async (input, ctx) => {
    // Only the month known: the tax is worked out for its first and last day.
    const month = input.first_registration.length === 7 ? input.first_registration : null;
    const firstRegistration = month ? `${month}-01` : input.first_registration;
    let ccm = input.displacement_ccm ?? null;
    let co2 = input.co2_g_per_km ?? null;
    let note = '';
    if (input.drive !== 'electric' && (ccm === null || co2 === null)) {
      const values = await engineValues(input, firstRegistration, ctx.now);
      if (typeof values === 'string') return { content: values, jump: pageJump('tax', TAX_JUMP) };
      if (values) {
        ccm ??= values.ccm;
        co2 ??= values.co2;
        note = values.note;
      }
    }
    const taxFor = (day: string) =>
      vehicleTax(
        {
          firstRegistration: day,
          drive: input.drive,
          displacementCcm: ccm,
          co2GPerKm: co2,
          emissionClass: null,
          grossWeightKg: input.gross_weight_kg ?? null,
        },
        germanDay(ctx.now),
      );
    const result = taxFor(firstRegistration);
    // In the current month, the last day that can be meant is today.
    const today = germanDay(ctx.now);
    const monthEnd = month ? taxFor([lastDayOfMonth(month), today].sort()[0]!) : result;
    if (result.kind === 'invalid') return fail(result.message);
    if (!sameTax(result, monthEnd)) {
      return {
        content: `Im Monat ${month?.split('-').reverse().join('/')} hängt die Steuer vom Tag der Erstzulassung ab (eine Stichtagsregel greift in diesem Monat). Frag nach dem genauen Datum (Fahrzeugschein, Feld B) und ruf das Werkzeug mit YYYY-MM-DD erneut auf.`,
        jump: pageJump('tax', TAX_JUMP),
      };
    }
    const params = new URLSearchParams({ ez: firstRegistration.slice(0, 7) });
    params.set(
      'antrieb',
      input.drive === 'petrol' ? 'benzin' : input.drive === 'diesel' ? 'diesel' : 'elektro',
    );
    const calculatorUrl = `/kfz-steuer-rechner?${params.toString()}`;
    if (result.kind === 'missing') {
      return {
        content: `Es fehlen Angaben: ${result.fields.join(', ')}${result.note ? ` (${result.note})` : ''}. Frag den Nutzer danach (Fahrzeugschein) oder zeig das Formular „tax“.`,
        jump: { label: TAX_JUMP, href: calculatorUrl },
      };
    }
    const inputs = [
      {
        label: 'Erstzulassung',
        value: month ? month.split('-').reverse().join('/') : germanDate(firstRegistration),
      },
      { label: 'Antrieb', value: DRIVE_LABELS[input.drive] },
      ...(ccm !== null ? [{ label: 'Hubraum', value: `${ccm.toLocaleString('de-DE')} cm³` }] : []),
      ...(co2 !== null ? [{ label: 'CO₂', value: `${co2.toLocaleString('de-DE')} g/km` }] : []),
    ];
    // With only the month known, the end of an exemption is only known to the month as well.
    const exemptUntil =
      result.kind !== 'exempt'
        ? ''
        : monthEnd.kind === 'exempt' && monthEnd.until !== result.until
          ? `${result.until.slice(5, 7)}/${result.until.slice(0, 4)} (je nach Tag der Erstzulassung)`
          : germanDate(result.until);
    const text =
      result.kind === 'amount'
        ? `Kfz-Steuer: ${euro(result.annualEur)} im Jahr (${result.parts.map((part) => `${part.label}: ${euro(part.amountEur)}`).join(', ')}). Regel: ${result.rule}`
        : `Steuerfrei bis ${exemptUntil}${result.afterwardsEur !== null ? `, danach ${euro(result.afterwardsEur)} im Jahr` : ''}. Regel: ${result.rule}`;
    return {
      content: `${text}\nEingaben: ${inputs.map((item) => `${item.label} ${item.value}`).join(', ')}. ${note} Verbindlich setzt das Hauptzollamt fest.`,
      card: {
        type: 'tax',
        annualEur: result.kind === 'amount' ? result.annualEur : null,
        exemptUntil: result.kind === 'exempt' ? exemptUntil : null,
        rule: result.rule,
        inputs,
        calculatorUrl,
      },
      context: text,
      jump: { label: TAX_JUMP, href: calculatorUrl },
    };
  },
);

// ---------------------------------------------------------------------------
// Financing
// ---------------------------------------------------------------------------

const financing = tool(
  {
    name: 'financing',
    strict: true,
    description:
      'Rechnet eine Autofinanzierung mit gleichen Monatsraten: Kaufpreis minus Anzahlung, Laufzeit und effektiver Jahreszins. Ohne Zins aus einem Angebot rechnet es mit dem Durchschnittszins der Bundesbank für Konsumentenkredite – das ist ein Beispiel, kein Angebot. KaufCheck vermittelt keine Kredite.',
    inputSchema: objectSchema(
      {
        price_eur: number('Kaufpreis in Euro'),
        down_payment_eur: number('Anzahlung in Euro'),
        months: integer('Laufzeit in Monaten (12 bis 84)'),
        rate_percent: number('Effektiver Jahreszins in Prozent aus dem Angebot'),
      },
      ['price_eur'],
    ),
  },
  'Rechne die Finanzierung',
  z.object({
    price_eur: z.number().min(100).max(10_000_000),
    down_payment_eur: z.number().min(0).max(10_000_000).optional(),
    months: z.number().int().min(6).max(120).optional(),
    rate_percent: z.number().min(0).max(30).optional(),
  }),
  (input) => {
    const downPaymentEur = input.down_payment_eur ?? 0;
    const months = input.months ?? 48;
    const averageRate = input.rate_percent === undefined;
    const ratePercent = input.rate_percent ?? AVERAGE_LOAN_RATE.percent;
    const proposal = financingProposal({
      priceEur: input.price_eur,
      downPaymentEur,
      months,
      ratePercent,
    });
    if (proposal.kind === 'invalid') return Promise.resolve(fail(proposal.message));
    if (proposal.kind === 'noLoan')
      return Promise.resolve({
        content: 'Die Anzahlung deckt den Kaufpreis (fast) ganz – kein Kredit nötig.',
      });
    const { result, amount } = proposal;
    const rateNote = averageRate
      ? `Durchschnittszins der Bundesbank (${AVERAGE_LOAN_RATE.month}${AVERAGE_LOAN_RATE.provisional ? ', vorläufig' : ''}), kein Angebot`
      : 'Zins aus dem Angebot des Nutzers';
    const text = `Kredit ${euro(amount)} über ${months} Monate zu ${ratePercent.toLocaleString('de-DE')} % effektiv (${rateNote}): ${euro(result.monthlyRate)} im Monat, Zinsen gesamt ${euro(result.totalInterest)}, zurückgezahlt ${euro(result.totalPaid)}.`;
    return Promise.resolve({
      content: text,
      card: {
        type: 'financing',
        priceEur: input.price_eur,
        downPaymentEur,
        amountEur: amount,
        months,
        ratePercent,
        averageRate,
        monthlyRate: result.monthlyRate,
        totalInterest: result.totalInterest,
        totalPaid: result.totalPaid,
        calculatorUrl: '/kfz-steuer-rechner#finanzierung',
      },
      context: text,
      jump: pageJump('financing', 'Im Finanzierungsrechner selbst rechnen'),
    });
  },
);

// ---------------------------------------------------------------------------
// Advisor
// ---------------------------------------------------------------------------

const carAdvisor = tool(
  {
    name: 'car_advisor',
    strict: true,
    description:
      'Schlägt passende Modelle aus den recherchierten Modellen von KaufCheck vor (Auto-Berater): nach Budget, Nutzung, Fahrleistung, Personen, Lademöglichkeit, Getriebe und bis zu zwei Prioritäten. Nur Antworten setzen, die der Nutzer gegeben hat.',
    inputSchema: objectSchema({
      budget_eur: integer('Höchster Kaufpreis in Euro'),
      usage: oneOf(USAGES, 'Hauptnutzung'),
      mileage: oneOf(MILEAGES, 'Fahrleistung: wenig, mittel, viel'),
      people: integer('Personen, die meist mitfahren: 2, 4, 5 oder 7'),
      charging: { type: 'boolean', description: 'Kann zu Hause oder bei der Arbeit laden' },
      transmission: oneOf(['manual', 'automatic'], 'Getriebe'),
      priorities: {
        type: 'array',
        items: oneOf(PRIORITIES, 'Priorität'),
        description: 'Höchstens zwei Prioritäten',
      },
    }),
  },
  'Suche passende Modelle',
  z.object({
    budget_eur: z.number().int().min(500).max(500_000).optional(),
    usage: z.enum(USAGES).optional(),
    mileage: z.enum(MILEAGES).optional(),
    people: z.union([z.literal(2), z.literal(4), z.literal(5), z.literal(7)]).optional(),
    charging: z.boolean().optional(),
    transmission: z.enum(['manual', 'automatic']).optional(),
    priorities: z.array(z.enum(PRIORITIES)).max(2).optional(),
  }),
  (input, ctx) => {
    const results = recommend(
      MODEL_INDEX,
      {
        budget: input.budget_eur ?? null,
        usage: input.usage ?? null,
        mileage: input.mileage ?? null,
        people: input.people ?? null,
        charging: input.charging ?? null,
        transmission: input.transmission ?? null,
        priorities: input.priorities ?? [],
      },
      5,
      ctx.now.getUTCFullYear(),
    );
    if (results.length === 0)
      return Promise.resolve({
        content:
          'Keine recherchierten Modelle passen zu allen Angaben. Schlag vor, das Budget oder die Anforderungen anzupassen, oder verweise auf /auto-berater.',
        jump: pageJump('advisor'),
      });
    const items = results.map((result) => {
      const params = toSearchParams({
        ...EMPTY_SEARCH,
        makeId: findMake(result.model.make)?.id ?? null,
        modelId: result.model.id,
        priceMax: input.budget_eur ?? null,
        yearMin: result.generation.years[0],
      });
      return {
        name: `${result.model.make} ${result.model.model}`,
        detail: `${result.generation.name} (${generationYearsLabel(result.generation.years)})${
          result.reasons.length > 0 ? ` – ${result.reasons.slice(0, 2).join(', ')}` : ''
        }`,
        url: `/modelle/${result.model.id}`,
        searchUrl: `/auto-finden?${params.toString()}`,
      };
    });
    return Promise.resolve({
      content: `Vorschläge (Reihenfolge nach Passung, ohne Gewähr):\n${items
        .map((item) => `${item.name}: ${item.detail} – ${item.url}`)
        .join('\n')}`,
      card: { type: 'advisor', items },
      context: `Berater-Vorschläge: ${items.map((item) => item.name).join(', ')}`,
      jump: pageJump('advisor'),
    });
  },
);

// ---------------------------------------------------------------------------
// RDW (cars from the Netherlands)
// ---------------------------------------------------------------------------

const ODOMETER_TEXT = {
  logical: 'Tachostand laut RDW logisch',
  illogical: 'Tachostand laut RDW unlogisch – Vorsicht',
  none: 'Kein Urteil zum Tachostand',
  unregistered: 'Tachostand nicht erfasst',
} as const;

const rdwCheck = (deps: ChatToolDeps) =>
  tool(
    {
      name: 'rdw_check',
      strict: true,
      description:
        'Fragt ein niederländisches Kennzeichen bei der RDW (offene Daten der niederländischen Zulassungsbehörde) ab: Tacho-Urteil, Rückrufe, APK (Hauptuntersuchung), Export, Taxi. Nur für Autos aus den Niederlanden.',
      inputSchema: objectSchema({ plate: string('Niederländisches Kennzeichen, z. B. 12-ABC-3') }, [
        'plate',
      ]),
    },
    'Frage bei der RDW nach',
    z.object({ plate: z.string().min(1).max(20) }),
    async (input) => {
      const plate = normalizeDutchPlate(input.plate);
      if (!plate) return fail('Das ist kein niederländisches Kennzeichen.');
      try {
        const { vehicle } = await deps.rdw.lookup(plate);
        if (!vehicle)
          return {
            content: `Zum Kennzeichen ${formatDutchPlate(plate)} hat die RDW kein Fahrzeug.`,
          };
        const openRecalls = vehicle.recalls.filter((recall) => recall.open).length;
        const warnings = [
          ...(vehicle.odometer.verdict === 'illogical' ? [ODOMETER_TEXT.illogical] : []),
          ...(openRecalls > 0 ? [`${openRecalls} offene Rückrufe`] : []),
          ...(vehicle.taxi ? ['Als Taxi eingetragen'] : []),
          ...(vehicle.exported ? ['Als exportiert gemeldet'] : []),
        ];
        const facts = [
          { label: 'Tacho', value: ODOMETER_TEXT[vehicle.odometer.verdict] },
          ...(vehicle.firstAdmission
            ? [
                {
                  label: 'Erstzulassung',
                  value: vehicle.firstAdmission.split('-').reverse().join('.'),
                },
              ]
            : []),
          ...(vehicle.apkUntil
            ? [{ label: 'APK bis', value: vehicle.apkUntil.split('-').reverse().join('.') }]
            : []),
          { label: 'Rückrufe', value: `${vehicle.recalls.length} gesamt, ${openRecalls} offen` },
        ];
        const title = `${vehicle.make} ${vehicle.model}`;
        return {
          content: `RDW zu ${formatDutchPlate(plate)}: ${title}. ${facts
            .map((fact) => `${fact.label}: ${fact.value}`)
            .join('; ')}. ${warnings.length > 0 ? `Achtung: ${warnings.join('; ')}.` : ''}`,
          card: { type: 'rdw', plate: formatDutchPlate(plate), title, facts, warnings },
          context: `RDW ${formatDutchPlate(plate)}: ${title}; ${warnings.join(', ') || 'keine Warnungen'}`,
          jump: pageJump('netherlands', 'RDW-Check und Ratgeber Niederlande'),
        };
      } catch (error) {
        if (isAppError(error)) return fail(error.message);
        throw error;
      }
    },
  );

// ---------------------------------------------------------------------------
// Input forms and app pages
// ---------------------------------------------------------------------------

const FormInput = z.object({
  form: z.enum(CHAT_FORMS),
  make: z.string().max(40).optional(),
  model: z.string().max(60).optional(),
  price_eur: z.number().min(0).max(10_000_000).optional(),
  down_payment_eur: z.number().min(0).max(10_000_000).optional(),
  months: z.number().int().min(6).max(120).optional(),
  first_registration: z.string().max(10).optional(),
  plate: z.string().max(20).optional(),
});

const showForm = tool(
  {
    name: 'show_form',
    strict: false,
    description:
      'Zeigt dem Nutzer ein Eingabefeld im Chat, wenn mehrere Angaben fehlen: „search“ (Autosuche), „financing“ (Kaufpreis, Anzahlung, Laufzeit, Zins), „tax“ (Werte aus dem Fahrzeugschein), „rdw“ (niederländisches Kennzeichen). Bekannte Werte vorausfüllen. Danach nur kurz sagen, dass das Formular unten steht, und auf die Eingabe warten.',
    inputSchema: objectSchema(
      {
        form: oneOf(CHAT_FORMS, 'Welches Formular'),
        make: string('Marke'),
        model: string('Modell'),
        price_eur: number('Kaufpreis'),
        down_payment_eur: number('Anzahlung'),
        months: integer('Laufzeit in Monaten'),
        first_registration: string('Erstzulassung YYYY-MM'),
        plate: string('Kennzeichen'),
      },
      ['form'],
    ),
  },
  'Zeige ein Formular',
  FormInput,
  ({ form, ...prefill }) =>
    Promise.resolve({
      content: `Formular „${form}“ wird angezeigt. Warte auf die Eingabe des Nutzers.`,
      jump: FORM_JUMPS[form](),
      card: {
        type: 'form',
        form,
        prefill: Object.fromEntries(
          Object.entries(prefill).filter(
            (entry): entry is [string, string | number] => entry[1] !== undefined,
          ),
        ),
      },
    }),
);

/** Pages of the app the assistant may point to, by key – no free URLs. */
export const APP_PAGES = {
  check: { label: 'Inserat prüfen', href: '/inserat-pruefen' },
  search: { label: 'Auto finden', href: '/auto-finden' },
  advisor: { label: 'Auto-Berater', href: '/auto-berater' },
  models: { label: 'Modelle und Schwachstellen', href: '/modelle' },
  tax: { label: 'Kfz-Steuer-Rechner', href: '/kfz-steuer-rechner' },
  financing: { label: 'Finanzierungsrechner', href: '/kfz-steuer-rechner#finanzierung' },
  costs: { label: 'Autokosten im Monat', href: '/autokosten-im-monat' },
  contract: { label: 'Kaufvertrag erstellen', href: '/kaufvertrag' },
  buying_guide: { label: 'Ratgeber Gebrauchtwagenkauf', href: '/gebrauchtwagen-kaufen' },
  checklist: { label: 'Checkliste Besichtigung', href: '/auto-besichtigung-checkliste' },
  register: { label: 'Auto ummelden', href: '/auto-ummelden' },
  recalls: { label: 'Rückrufe prüfen', href: '/auto-rueckruf-pruefen' },
  netherlands: { label: 'Auto aus den Niederlanden', href: '/auto-aus-den-niederlanden' },
  selling: { label: 'Auto privat verkaufen', href: '/auto-verkaufen' },
  listing_text: { label: 'Inseratstext schreiben', href: '/inseratstext' },
  my_car: { label: 'Mein Auto (HU-Erinnerung, Kostenbuch)', href: '/mein-auto' },
  saved: { label: 'Gespeicherte Angebote', href: '/meine-angebote' },
  pro: { label: 'KaufCheck Pro', href: '/pro' },
} as const;
export type AppPage = keyof typeof APP_PAGES;

const TAX_JUMP = 'Im Kfz-Steuer-Rechner selbst rechnen';

/** How the button to each page reads, e.g. „Zum Finanzierungsrechner“. */
const JUMP_LABELS: Record<AppPage, string> = {
  check: 'Zur Inseratsprüfung',
  search: 'Zur Autosuche',
  advisor: 'Zum Auto-Berater',
  models: 'Zu den Modellen und Schwachstellen',
  tax: 'Zum Kfz-Steuer-Rechner',
  financing: 'Zum Finanzierungsrechner',
  costs: 'Zu den Autokosten im Monat',
  contract: 'Zum Kaufvertrag',
  buying_guide: 'Zum Ratgeber Gebrauchtwagenkauf',
  checklist: 'Zur Checkliste für die Besichtigung',
  register: 'Zum Ratgeber Auto ummelden',
  recalls: 'Zu den Rückrufen',
  netherlands: 'Zum Ratgeber Auto aus den Niederlanden',
  selling: 'Zum Ratgeber Auto verkaufen',
  listing_text: 'Zum Inseratstext',
  my_car: 'Zu Mein Auto',
  saved: 'Zu den gespeicherten Angeboten',
  pro: 'Zu KaufCheck Pro',
};

/** A page of KaufCheck to do it yourself. */
function pageJump(key: AppPage, label = JUMP_LABELS[key]): ChatJump {
  return { label, href: APP_PAGES[key].href };
}

const FORM_JUMPS: Record<ChatFormKind, () => ChatJump> = {
  search: () => pageJump('search'),
  financing: () => pageJump('financing'),
  tax: () => pageJump('tax'),
  rdw: () => pageJump('netherlands', 'RDW-Check und Ratgeber Niederlande'),
};

/**
 * Topics of a message without a tool, and the page for each – the first match
 * counts. Word stems with boundaries: „Erstzulassung“ is no re-registration,
 * „Steuerkette“ no tax and „versuche“ no search.
 */
const TOPICS: readonly [RegExp, AppPage][] = [
  [/finanzier|\bkredit|\braten?\b|leasing|anzahlung/i, 'financing'],
  [/kfz-steuer|\bsteuer\b|\bsteuern\b|\bversteuer/i, 'tax'],
  [/schwachstell|zuverlässig|typische probleme|\bmacken\b/i, 'models'],
  [/unterhalt|kosten im monat|\bverbrauch|versicherung/i, 'costs'],
  [/kaufvertrag|\bvertrag\b/i, 'contract'],
  [/besichtig|probefahrt|checkliste/i, 'checklist'],
  [
    /\bummeld|\bmelde\b[^.?!]{0,60}\bum\b|\bzulassen\b|\bzulassung\b|zulassungsstelle|\babmeld|\b(?:auto|wagen|fahrzeug)\s+(?:an|um)melden/i,
    'register',
  ],
  [/rückruf/i, 'recalls'],
  [/niederland|holland|\brdw\b|\bimport/i, 'netherlands'],
  [/\bverkaufen\b|\bverkauf (?:mein|unser)|inzahlung/i, 'selling'],
  [/welches auto|passt zu mir|empfiehlst|empfehlung|\bberat/i, 'advisor'],
  [/\binserat|\bprüf/i, 'check'],
  [/\bsuche\b|\bsuchen\b|\bsuch\b|\bfinden\b|\bfinde ich\b|gebrauchtwagen/i, 'search'],
];

/**
 * Where to go on yourself after an answer without a tool: the page that fits
 * the message, otherwise the two main tools.
 */
export function topicJumps(...texts: string[]): ChatJump[] {
  for (const text of texts) {
    const match = TOPICS.find(([pattern]) => pattern.test(text));
    if (match) return [pageJump(match[1])];
  }
  return [pageJump('search'), pageJump('check')];
}

/** Labels of a copied listing, each at the start of a line („Kilometerstand 57.000 km“). */
const LISTING_LABELS = [
  /^kilometer(?:stand)?\b/i,
  /^laufleistung\b/i,
  /^erstzulassung\b/i,
  /^leistung\b/i,
  /^kraftstoff(?:art)?\b/i,
  /^getriebe(?:art)?\b/i,
  /^fahrzeughalter\b|^anzahl der (?:fahrzeug)?halter\b|^vorbesitzer\b/i,
  /^hubraum\b/i,
  /^(?:außen)?farbe\b/i,
  /^(?:hu|tüv)\b/i,
  /^schadstoffklasse\b|^emissionsklasse\b|^umweltplakette\b/i,
  /^(?:anzahl der )?(?:sitzplätze|türen)\b/i,
  /^fahrzeugzustand\b|^zustand\b/i,
  /^karosserieform\b|^fahrzeugtyp\b|^kategorie\b/i,
  /^(?:fahrzeug)?beschreibung\b/i,
  /^ausstattung\b/i,
  /^antriebsart\b/i,
  /^baujahr\b/i,
];

/**
 * A line that starts with the price: „8.700 €“, „8450 €“, „850 € VB“,
 * „€ 12.990,-“, „EUR 12.990“, „16.990 € inkl. MwSt.“, „Kaufpreis: 9.500 EUR“.
 */
const PRICE_NUMBER = String.raw`(?:\d{1,3}(?:[.\s]\d{3})+|\d{1,6})(?:,-|,\d{2})?`;
/**
 * What may follow the price on its line – nothing a wish list would write
 * („maximal“). Free text only once and at the end („inkl. MwSt.“): words that
 * can swallow each other would make the check take exponentially long.
 */
const PRICE_SUFFIX = String.raw`(?:\s*(?:vb|verhandlungsbasis|festpreis|\(?brutto\)?|\(?netto\)?|mwst\.?|[¹²³*]))*(?:\s*(?:inkl|zzgl)\.[^\n]{0,30})?`;
/** A price line is short; longer lines are not even tested. */
const MAX_PRICE_LINE = 80;
const PRICE_LINE = new RegExp(
  String.raw`^(?:(?:kauf)?preis:?\s*|brutto:?\s*|netto:?\s*)?(?:(?:€|eur)\s?${PRICE_NUMBER}|${PRICE_NUMBER}\s?(?:€|eur\b))${PRICE_SUFFIX}\s*$`,
  'i',
);

/**
 * A pasted listing: many lines, a line with only the price and several of the
 * labels a listing page shows, each on its own line. A question with a price
 * and a mileage in a sentence is not one – checking it would cost one of the
 * visitor's monthly checks.
 */
export function looksLikePastedListing(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (text.length < 200 || lines.length < 6) return false;
  if (!lines.some((line) => line.length <= MAX_PRICE_LINE && PRICE_LINE.test(line))) return false;
  const labels = LISTING_LABELS.filter((label) => lines.some((line) => label.test(line)));
  return labels.length >= 3;
}

const PAGE_KEYS = Object.keys(APP_PAGES) as [AppPage, ...AppPage[]];

const showLinks = tool(
  {
    name: 'show_links',
    strict: true,
    description:
      'Zeigt Schaltflächen zu Seiten von KaufCheck, wenn der Nutzer dort weitermachen soll (z. B. Kaufvertrag, Checkliste, Mein Auto). Höchstens drei.',
    inputSchema: objectSchema(
      { pages: { type: 'array', items: oneOf(PAGE_KEYS, 'Seite'), description: 'Seiten' } },
      ['pages'],
    ),
  },
  'Suche die passenden Seiten',
  z.object({ pages: z.array(z.enum(PAGE_KEYS)).min(1).max(3) }),
  ({ pages }) =>
    Promise.resolve({
      content: `Schaltflächen angezeigt: ${pages.map((page) => APP_PAGES[page].label).join(', ')}`,
      card: { type: 'links', links: pages.map((page) => ({ ...APP_PAGES[page] })) },
    }),
);

export function createChatTools(deps: ChatToolDeps): ChatTool[] {
  return [
    analyzeListing(deps),
    searchCars,
    modelInfo,
    vehicleTaxTool,
    financing,
    carAdvisor,
    rdwCheck(deps),
    showForm,
    showLinks,
  ];
}
