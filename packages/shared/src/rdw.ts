import { z } from 'zod';

/**
 * Vehicles registered in the Netherlands, from the open data of the Dutch
 * vehicle authority RDW (public domain): registration, the RDW's verdict on
 * the odometer readings, open recalls and the defects found at the periodic
 * inspection (APK). Asked by the Dutch registration number (kenteken). An
 * exported car stays in the data only for a while.
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

/**
 * „AB123C“ → „AB-123-C“, „NBPZ15“ → „NB-PZ-15“: hyphens where letters and
 * digits meet, and a run of four split in the middle (the older sidecodes).
 */
export function formatDutchPlate(plate: string): string {
  const runs = plate.match(/[A-Z]+|\d+/g) ?? [plate];
  return runs
    .flatMap((run) =>
      runs.length === 2 && run.length === 4 ? [run.slice(0, 2), run.slice(2)] : [run],
    )
    .join('-');
}

export const ODOMETER_VERDICTS = ['logical', 'illogical', 'none', 'unregistered'] as const;
export type OdometerVerdict = (typeof ODOMETER_VERDICTS)[number];

/** The RDW's verdicts in German („Logisch“, „Onlogisch“, „Geen oordeel“, „Niet geregistreerd“). */
export const ODOMETER_VERDICT_LABELS: Record<OdometerVerdict, string> = {
  logical: 'Logisch',
  illogical: 'Unlogisch',
  none: 'Kein Urteil',
  unregistered: 'Nicht registriert',
};

/**
 * KaufCheck's translation of the RDW's explanations of its verdict (dataset
 * „Tellerstandoordeel Trend Toelichting“, codes 00–07 and NG), close to the
 * Dutch original; „wir“ of the RDW is written as „die RDW“.
 */
export const ODOMETER_EXPLANATIONS: Record<string, string> = {
  '00': 'Der registrierte Kilometerstand ist jedes Mal höher als der davor registrierte. Die RDW urteilt dann, dass der Kilometerstand logisch erklärbar ist.',
  '01': 'Dieses Fahrzeug hat einen Zähler, der nicht bis 999.999 zählt, oder der Zähler hat den Höchststand erreicht und ist danach wieder auf null gesprungen. Dadurch stimmt der Stand auf dem Zähler möglicherweise nicht mit den Kilometern oder Meilen überein, die das Fahrzeug wirklich gefahren ist. Deshalb gibt die RDW kein Urteil über die Reihe der Kilometerstände dieses Fahrzeugs ab.',
  '02': 'In diesem Fahrzeug wurde der Zähler ersetzt oder repariert. In diesem Fall ist nicht klar, wie viel das Fahrzeug genau gefahren ist. Deshalb gibt die RDW kein Urteil über die Reihe der Kilometerstände dieses Fahrzeugs ab.',
  '03': 'Der registrierte Kilometerstand ist jedes Mal höher als der davor registrierte. Die RDW urteilt dann, dass der Kilometerstand logisch erklärbar ist.',
  '04': 'In der Reihe der Kilometerstände ist ein Stand registriert, der niedriger ist als der Stand davor. Es kann sein, dass der Zähler zurückgedreht wurde oder dass ein Tippfehler gemacht wurde. Die RDW stützt das Urteil „unlogisch“ nur auf Messungen nach dem 1. Januar 2014. Seit diesem Datum ist sie für die Registrierung der Kilometerstände verantwortlich.',
  '05': 'Die RDW gibt kein Urteil über die Reihe der Kilometerstände dieses Fahrzeugs ab. Das kann zwei Ursachen haben: Das Fahrzeug war außerhalb der Niederlande registriert, oder am Fahrzeug wurde etwas geändert, wodurch es ein anderes Kennzeichen bekommen hat.',
  '06': 'Für dieses Fahrzeug sind weniger als zwei Stände registriert. Die RDW kann nur über eine Reihe von Kilometerständen urteilen. Deshalb gibt sie kein Urteil über den Kilometerstand ab.',
  '07': 'Der Kilometerstand dieses Fahrzeugs hat von der Stiftung NAP, die früher in den Niederlanden Kilometerstände registrierte, das Urteil „unlogisch“ bekommen. Es kann sein, dass der Zähler zurückgedreht wurde oder dass ein Tippfehler gemacht wurde. Die RDW darf das Urteil „unlogisch“ nur bei Messungen nach dem 1. Januar 2014 abgeben. Deshalb gibt sie kein Urteil über die Zuverlässigkeit der gesamten Reihe der Kilometerstände dieses Fahrzeugs ab.',
  NG: 'Nicht registriert.',
};

/** The RDW's fuel names in German; others as given. */
export const RDW_FUEL_LABELS: Record<string, string> = {
  Benzine: 'Benzin',
  Diesel: 'Diesel',
  Elektriciteit: 'Strom',
  LPG: 'Autogas (LPG)',
  CNG: 'Erdgas (CNG)',
  LNG: 'Flüssigerdgas (LNG)',
  Waterstof: 'Wasserstoff',
  Alcohol: 'Alkohol',
};

/** The RDW's vehicle types in German; others as given. */
export const RDW_KIND_LABELS: Record<string, string> = {
  Personenauto: 'Pkw',
  Bedrijfsauto: 'Nutzfahrzeug',
  Motorfiets: 'Motorrad',
  Bromfiets: 'Moped',
  Aanhangwagen: 'Anhänger',
  Oplegger: 'Auflieger',
  Bus: 'Bus',
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
  /** Defects and advice points of the APK (the open data keeps about three years), the newest first. */
  inspections: z.array(
    z.object({
      date: Day,
      defects: z.array(
        z.object({
          code: z.string(),
          count: z.number().int().positive(),
          /** The RDW's Dutch description. */
          description: z.string().nullable(),
          /** An advice point (codes AC…), no failure. */
          advisory: z.boolean(),
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
