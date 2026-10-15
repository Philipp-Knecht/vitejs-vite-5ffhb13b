import type { SaleContractValues } from '@kaufcheck/shared';

export type ContractRole = '' | 'private' | 'business';

export interface SaleContractDraft {
  /** The check the form was prefilled from, or empty. */
  source: string;
  seller: ContractRole;
  buyer: ContractRole;
  values: SaleContractValues;
}

/**
 * What was typed into the contract, kept in memory only: it survives a click
 * on a link within the app, but not a reload or closing the tab, and it is
 * never written to the browser's storage.
 */
let draft: SaleContractDraft | null = null;

export const readSaleContractDraft = (source: string) => (draft?.source === source ? draft : null);

export function keepSaleContractDraft(next: SaleContractDraft): void {
  draft = next;
}

/** On logout or an account switch, e.g. on a shared device. */
export function clearSaleContractDraft(): void {
  draft = null;
}
