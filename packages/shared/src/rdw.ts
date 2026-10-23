import { z } from 'zod';

/**
 * Vehicles registered in the Netherlands, from the open data of the Dutch
 * vehicle authority RDW (public domain): registration, the RDW's verdict on
 * the odometer readings, open recalls and the defects found at the periodic
 * inspection (APK). Asked by the Dutch registration number (kenteken), which
 * stays in the data after a car was exported.
 */

export const RDW_SOURCE = {
  name: 'RDW Open Data',
  url: 'https://opendata.rdw.nl/',
  licence: 'Public Domain (CC0)',
} as const;

/** „AB-123-C“, „ab 123 c“ → „AB123C“; null for anything that is no Dutch registration number. */
export function normalizeDutchPlate(raw: string): string | null {
  const plate = raw.toUpperCase().replace(/[\s.-]/g, '');
  // Six letters and digits, with at least one of each (the sidecodes since 1951).
  return /^[A-Z0-9]{6}$/.test(plate) && /\d/.test(plate) && /[A-Z]/.test(plate) ? plate : null;
}

/** „AB123C“ → „AB-123-C“: a hyphen where letters and digits meet, as on the plate. */
export function formatDutchPlate(plate: string): string {
  return plate.replace(/(?<=[A-Z])(?=\d)|(?<=\d)(?=[A-Z])/g, '-');
}

export const ODOMETER_VERDICTS = ['logical', 'illogical', 'none', 'unregistered'] as const;
export type OdometerVerdict = (typeof ODOMETER_VERDICTS)[number];

/** The RDW's verdicts in German („Logisch“, „Onlogisch“, „Geen oordeel“, „Niet geregistreerd“). */
export const ODOMETER_VERDICT_LABELS: Record<OdometerVerdict, string> = {
  logical: 'Logisch (plausibel)',
  illogical: 'Unlogisch',
  none: 'Keine Bewertung',
  unregistered: 'Nicht registriert',
};

/**
 * KaufCheck's translation of the RDW's explanations of its verdict (dataset
 * „Tellerstandoordeel Trend Toelichting“, codes 00–07 and NG).
 */
export const ODOMETER_EXPLANATIONS: Record<string, string> = {
  '00': 'Jeder gemeldete Kilometerstand ist höher als der davor. Die RDW bewertet den Verlauf deshalb als logisch.',
  '01': 'Der Tacho zählt nicht bis 999.999 oder ist nach dem Höchststand wieder auf null gesprungen. Der angezeigte Stand entspricht deshalb womöglich nicht der echten Laufleistung; die RDW bewertet den Verlauf nicht.',
  '02': 'Der Tacho wurde ersetzt oder repariert. Wie weit das Auto genau gefahren ist, ist unklar; die RDW bewertet den Verlauf nicht.',
  '03': 'Jeder gemeldete Kilometerstand ist höher als der davor. Die RDW bewertet den Verlauf deshalb als logisch.',
  '04': 'Ein gemeldeter Kilometerstand ist niedriger als der davor. Der Tacho kann zurückgedreht oder ein Tippfehler gemacht worden sein. Als „unlogisch“ bewertet die RDW nur Messungen ab dem 1. Januar 2014.',
  '05': 'Die RDW bewertet den Verlauf nicht: Das Auto war außerhalb der Niederlande zugelassen, oder es hat nach einer Änderung ein anderes Kennzeichen bekommen.',
  '06': 'Es sind weniger als zwei Kilometerstände gemeldet. Bewerten kann die RDW nur eine Reihe von Ständen.',
  '07': 'Die Stiftung NAP, die früher in den Niederlanden Kilometerstände erfasste, hat den Verlauf als „unlogisch“ bewertet: Der Tacho kann zurückgedreht oder ein Tippfehler gemacht worden sein. Die RDW selbst bewertet nur Messungen ab dem 1. Januar 2014 und deshalb nicht die ganze Reihe.',
  NG: 'Für dieses Auto sind keine Kilometerstände registriert.',
};

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const RdwVehicleSchema = z.object({
  plate: z.string(),
  make: z.string(),
  model: z.string(),
  /** Vehicle type as the RDW names it, e.g. „Personenauto“. */
  kind: z.string(),
  /** First admission anywhere (datum eerste toelating). */
  firstAdmission: Day.nullable(),
  /** First registration in the Netherlands; later than the first admission for an import. */
  firstRegistrationNl: Day.nullable(),
  /** The last change of keeper in the Netherlands. */
  lastKeeperChange: Day.nullable(),
  apkUntil: Day.nullable(),
  exported: z.boolean(),
  taxi: z.boolean(),
  insured: z.boolean().nullable(),
  /** List price in euros as registered (catalogusprijs). */
  listPriceEur: z.number().nullable(),
  color: z.string().nullable(),
  odometer: z.object({
    verdict: z.enum(ODOMETER_VERDICTS),
    /** The code of the RDW's explanation, see ODOMETER_EXPLANATIONS. */
    code: z.string().nullable(),
    /** The year of the last odometer reading registered. */
    lastReadingYear: z.number().int().nullable(),
  }),
  recalls: z.array(
    z.object({
      reference: z.string(),
      /** Still open, or reported as repaired by the manufacturer. */
      open: z.boolean(),
    }),
  ),
  /** Defects found at inspections, the newest first. */
  inspections: z.array(
    z.object({
      date: Day,
      defects: z.array(
        z.object({
          code: z.string(),
          count: z.number().int().positive(),
          /** The RDW's Dutch description. */
          description: z.string().nullable(),
        }),
      ),
    }),
  ),
  fuels: z.array(
    z.object({
      fuel: z.string(),
      kw: z.number().nullable(),
    }),
  ),
});
export type RdwVehicle = z.infer<typeof RdwVehicleSchema>;

export const RdwLookupResponseSchema = z.object({
  vehicle: RdwVehicleSchema.nullable(),
  /** When the RDW was asked, ISO timestamp. */
  checkedAt: z.string(),
});
export type RdwLookupResponse = z.infer<typeof RdwLookupResponseSchema>;
