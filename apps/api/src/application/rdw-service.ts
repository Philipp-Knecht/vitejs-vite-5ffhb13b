import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RdwVehicleSchema,
  type OdometerVerdict,
  type RdwLookupResponse,
  type RdwVehicle,
} from '@kaufcheck/shared';
import { AppError } from '../lib/errors';

/** Datasets of RDW Open Data (opendata.rdw.nl), all public domain. */
const DATASETS = {
  vehicles: 'm9d7-ebf2',
  fuels: '8ys7-d773',
  recalls: 't49b-isb7',
  inspections: 'a34c-vvps',
  defects: 'hx2c-gt7k',
} as const;
const BASE = 'https://opendata.rdw.nl/resource';

const CACHE_SIZE = 500;
const CACHE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

type Row = Record<string, string | undefined>;
export type RdwFetch = (dataset: string, query: Record<string, string>) => Promise<Row[]>;

export interface RdwServiceOptions {
  mode: 'off' | 'live' | 'fixtures';
  fixturesDir: string;
  /** For tests: the request to the RDW. */
  fetchRows?: RdwFetch;
  now?: () => Date;
}

const liveFetch: RdwFetch = async (dataset, query) => {
  const url = new URL(`${BASE}/${dataset}.json`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'error',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`RDW ${dataset}: HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error(`RDW ${dataset}: no list`);
  return body as Row[];
};

/** „20110228“ → „2011-02-28“. */
const day = (value: string | undefined) =>
  value && /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
    : null;
const yes = (value: string | undefined) => value === 'Ja';
const number = (value: string | undefined) => {
  const parsed = value === undefined || value === '' ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const VERDICTS: Record<string, OdometerVerdict> = {
  Logisch: 'logical',
  Onlogisch: 'illogical',
  'Geen oordeel': 'none',
  'Niet geregistreerd': 'unregistered',
};

/** Only letters and digits reach a query: the plate is checked before, the codes come from the RDW. */
const quoted = (value: string) => `'${value.replace(/[^A-Za-z0-9]/g, '')}'`;

export class RdwService {
  private readonly cache = new Map<string, { at: number; response: RdwLookupResponse }>();
  private readonly fetchRows: RdwFetch;
  private readonly now: () => Date;

  constructor(private readonly options: RdwServiceOptions) {
    this.fetchRows = options.fetchRows ?? liveFetch;
    this.now = options.now ?? (() => new Date());
  }

  get available(): boolean {
    return this.options.mode !== 'off';
  }

  /** The vehicle with a normalized Dutch registration number, or null when the RDW has none. */
  async lookup(plate: string): Promise<RdwLookupResponse> {
    if (this.options.mode === 'off') throw new AppError('SERVICE_UNAVAILABLE');
    const now = this.now();
    const cached = this.cache.get(plate);
    if (cached && now.getTime() - cached.at < CACHE_MS) return cached.response;

    let vehicle: RdwVehicle | null;
    try {
      vehicle =
        this.options.mode === 'fixtures' ? await this.fixture(plate) : await this.fromRdw(plate);
    } catch (error) {
      throw new AppError('SERVICE_UNAVAILABLE', {
        message:
          'Die Datenbank der RDW ist gerade nicht erreichbar. Bitte versuch es später noch einmal.',
        internalReason: error instanceof Error ? error.message : String(error),
        cause: error,
      });
    }
    const response = { vehicle, checkedAt: now.toISOString() };
    this.cache.delete(plate);
    this.cache.set(plate, { at: now.getTime(), response });
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
    return response;
  }

  private async fixture(plate: string): Promise<RdwVehicle | null> {
    try {
      const file = await readFile(path.join(this.options.fixturesDir, `${plate}.json`), 'utf8');
      return RdwVehicleSchema.parse(JSON.parse(file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private async fromRdw(plate: string): Promise<RdwVehicle | null> {
    const where = { kenteken: plate };
    const [vehicles, fuels, recalls, inspections] = await Promise.all([
      this.fetchRows(DATASETS.vehicles, { ...where, $limit: '1' }),
      this.fetchRows(DATASETS.fuels, { ...where, $limit: '10' }),
      this.fetchRows(DATASETS.recalls, { ...where, $limit: '100' }),
      this.fetchRows(DATASETS.inspections, {
        ...where,
        $order: 'meld_datum_door_keuringsinstantie DESC',
        $limit: '200',
      }),
    ]);
    const row = vehicles[0];
    if (!row) return null;

    const codes = [...new Set(inspections.map((item) => item.gebrek_identificatie ?? ''))]
      .filter(Boolean)
      .slice(0, 100);
    const descriptions = new Map<string, string>();
    if (codes.length > 0) {
      const defects = await this.fetchRows(DATASETS.defects, {
        $where: `gebrek_identificatie in (${codes.map(quoted).join(',')})`,
        $limit: '500',
      });
      // A defect can have several versions over time; the newest description wins.
      for (const defect of defects.sort((a, b) =>
        (a.ingangsdatum_gebrek ?? '').localeCompare(b.ingangsdatum_gebrek ?? ''),
      ))
        if (defect.gebrek_identificatie && defect.gebrek_omschrijving)
          descriptions.set(defect.gebrek_identificatie, defect.gebrek_omschrijving);
    }

    const byDate = new Map<string, RdwVehicle['inspections'][number]['defects']>();
    for (const item of inspections) {
      const date = day(item.meld_datum_door_keuringsinstantie);
      const code = item.gebrek_identificatie;
      if (!date || !code) continue;
      const list = byDate.get(date) ?? [];
      list.push({
        code,
        count: Math.max(1, number(item.aantal_gebreken_geconstateerd) ?? 1),
        description: descriptions.get(code) ?? null,
      });
      byDate.set(date, list);
    }

    return RdwVehicleSchema.parse({
      plate,
      make: row.merk ?? '',
      model: row.handelsbenaming ?? '',
      kind: row.voertuigsoort ?? '',
      firstAdmission: day(row.datum_eerste_toelating),
      firstRegistrationNl: day(row.datum_eerste_tenaamstelling_in_nederland),
      lastKeeperChange: day(row.datum_tenaamstelling),
      apkUntil: day(row.vervaldatum_apk),
      exported: yes(row.export_indicator),
      taxi: yes(row.taxi_indicator),
      insured: row.wam_verzekerd === undefined ? null : yes(row.wam_verzekerd),
      listPriceEur: number(row.catalogusprijs),
      color: row.eerste_kleur && row.eerste_kleur !== 'N.v.t.' ? row.eerste_kleur : null,
      odometer: {
        verdict: VERDICTS[row.tellerstandoordeel ?? ''] ?? 'unregistered',
        code: row.code_toelichting_tellerstandoordeel ?? null,
        lastReadingYear: number(row.jaar_laatste_registratie_tellerstand),
      },
      recalls: recalls
        .filter((item) => item.referentiecode_rdw)
        .map((item) => ({ reference: item.referentiecode_rdw!, open: item.code_status === 'O' })),
      inspections: [...byDate]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, defects]) => ({ date, defects })),
      fuels: fuels.map((item) => ({
        fuel: item.brandstof_omschrijving ?? '',
        kw: number(item.nettomaximumvermogen),
      })),
    });
  }
}
