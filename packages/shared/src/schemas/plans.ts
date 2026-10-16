import { z } from 'zod';
import { PLANS } from '../plans';

export const PlanSchema = z.enum(PLANS);

export const EntitlementsSchema = z.object({
  monthlyAnalyses: z.number().int().nonnegative(),
  savedListingsMax: z.number().int().nonnegative(),
  /** Maximum listings per comparison; 0 = comparison not available. */
  compareMax: z.number().int().nonnegative(),
  /** Saved car searches (all marketplaces); 0 = not available. */
  savedSearchesMax: z.number().int().nonnegative(),
  /** Cars in „Mein Auto“; 0 = not available. */
  ownedCarsMax: z.number().int().nonnegative(),
  history: z.boolean(),
  /** Download an analysis with checklist as a PDF file. */
  pdfExport: z.boolean(),
  /** Negotiation help: own findings and a message to the seller. */
  negotiationHelp: z.boolean(),
  /** Purchase contract for a private sale as a PDF, built in the browser. */
  saleContract: z.boolean(),
  /** Listing text for selling one's own car, built in the browser. */
  listingText: z.boolean(),
  /** Cost book and service history for the cars in „Mein Auto“. */
  carLog: z.boolean(),
  /** Monthly costs of the offers in a comparison, from the buyer's own figures. */
  monthlyCosts: z.boolean(),
  photoAnalysis: z.boolean(),
  showAds: z.boolean(),
});
export type Entitlements = z.infer<typeof EntitlementsSchema>;
