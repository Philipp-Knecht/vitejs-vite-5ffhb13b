import type { Entitlements } from '../schemas/plans';
import type { PaymentMethod, ProOffer, VatMode } from '../schemas/contracts';
import { WITHDRAWAL_PERIOD_DAYS } from './withdrawal';

export const PRO_PRODUCT_NAME = 'KaufCheck Pro (Monatsabo)';

/** Version of the terms and the order wording; stored with every order. */
export const TERMS_VERSION = '2026-10-01';

/** Checkbox texts on the order page; stored verbatim with the order as evidence. */
export const ORDER_CONSENT_TEXTS = {
  acceptTerms: 'Ich akzeptiere die Allgemeinen Geschäftsbedingungen (AGB) von KaufCheck Pro.',
  requestImmediateStart:
    'Ich verlange ausdrücklich, dass KaufCheck Pro sofort nach Vertragsschluss bereitgestellt wird, also schon vor Ablauf der Widerrufsfrist. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag für die Zeit bis zum Widerruf zahle (Wertersatz).',
} as const;

/** Exact label of the order button (§ 312j Abs. 3 BGB). */
export const ORDER_BUTTON_LABEL = 'Zahlungspflichtig bestellen';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Kredit- oder Debitkarte',
  sepa_debit: 'SEPA-Lastschrift',
  paypal: 'PayPal',
};

const TIME_ZONE = 'Europe/Berlin';

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** "1. Oktober 2026" in German time. */
export function formatLegalDate(date: Date | string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: TIME_ZONE }).format(
    new Date(date),
  );
}

/** "1. Oktober 2026 um 14:32:05 Uhr" in German time. */
export function formatLegalDateTime(date: Date | string): string {
  const value = new Date(date);
  const time = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: TIME_ZONE,
  }).format(value);
  return `${formatLegalDate(value)} um ${time} Uhr`;
}

export function vatNote(mode: VatMode): string {
  return mode === 'small_business'
    ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'
    : 'Der Preis enthält 19 % Umsatzsteuer.';
}

export function paymentMethodsText(methods: readonly PaymentMethod[]): string {
  return methods.map((method) => PAYMENT_METHOD_LABELS[method]).join(', ');
}

/** What Pro includes – the essential characteristics of the service (Art. 246a § 1 Abs. 1 Nr. 1 EGBGB). */
export function proFeatures(pro: Entitlements, options: { photoAnalysis: boolean }): string[] {
  const features = [
    `${pro.monthlyAnalyses} Prüfungen von Inseraten pro Kalendermonat`,
    `bis zu ${pro.savedListingsMax} gespeicherte Angebote`,
    `Vergleiche von bis zu ${pro.compareMax} Angeboten nebeneinander`,
  ];
  if (pro.savedSearchesMax > 0) {
    features.push(`bis zu ${pro.savedSearchesMax} gespeicherte Gebrauchtwagen-Suchen`);
  }
  if (pro.history) features.push('Verlauf aller deiner Prüfungen');
  if (pro.photoAnalysis && options.photoAnalysis) {
    features.push('KI-Fotoanalyse bei Inseraten mit Fotos');
  }
  if (!pro.showAds) features.push('keine Werbung');
  features.push(
    'alle Funktionen der kostenlosen Nutzung, etwa Fragen an den Verkäufer, Checkliste und Preisrechnung',
  );
  return features;
}

export interface ContractTerm {
  label: string;
  value: string;
}

/**
 * Price, term and cancellation conditions shown directly above the order
 * button and repeated in the confirmation (§ 312j Abs. 2 BGB with Art. 246a
 * § 1 Abs. 1 Nr. 5, 8, 14 and 15 EGBGB).
 */
export function contractTerms(offer: Pick<ProOffer, 'priceCents' | 'vatMode'>): ContractTerm[] {
  const price = formatCents(offer.priceCents);
  return [
    { label: 'Preis', value: `${price} pro Monat. ${vatNote(offer.vatMode)}` },
    { label: 'Monatliche Gesamtkosten', value: `${price}, weitere Kosten fallen nicht an` },
    {
      label: 'Abrechnung',
      value: 'monatlich im Voraus, die erste Zahlung bei Vertragsschluss',
    },
    {
      label: 'Laufzeit',
      value: 'unbefristet; das Abo verlängert sich automatisch um jeweils einen Monat',
    },
    { label: 'Mindestlaufzeit', value: 'ein Monat' },
    {
      label: 'Kündigung',
      value: 'jederzeit zum Ende des laufenden Abrechnungsmonats, ohne Kündigungsfrist',
    },
  ];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar date in German time as YYYY-MM-DD. */
export function berlinDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date);
  return parts;
}

/**
 * Last day to withdraw: fourteen days after the day the contract was
 * concluded (§§ 187 Abs. 1, 188 Abs. 2 BGB), moved to Monday when it falls
 * on a weekend (§ 193 BGB). Public holidays may extend it further; the
 * withdrawal function stays available regardless.
 */
export function withdrawalDeadline(concludedAt: Date): string {
  const [year, month, day] = berlinDate(concludedAt).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const last = new Date(Date.UTC(year, month - 1, day) + WITHDRAWAL_PERIOD_DAYS * DAY_MS);
  const weekday = last.getUTCDay();
  if (weekday === 6) last.setUTCDate(last.getUTCDate() + 2);
  if (weekday === 0) last.setUTCDate(last.getUTCDate() + 1);
  return last.toISOString().slice(0, 10);
}

/** Whether a declaration received at `at` is within the withdrawal period. */
export function withinWithdrawalPeriod(concludedAt: Date, at: Date): boolean {
  return berlinDate(at) <= withdrawalDeadline(concludedAt);
}

/** "15. Oktober 2026" for a YYYY-MM-DD date. */
export function formatLegalDay(day: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}
