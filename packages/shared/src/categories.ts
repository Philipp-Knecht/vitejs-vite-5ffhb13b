/**
 * Listing categories. Only `vehicle` (cars) is implemented today; the others
 * are reserved so that new category analyzers can be added without changing
 * contracts or persisted data.
 */
export const LISTING_CATEGORIES = [
  'vehicle',
  'electronics',
  'computer',
  'smartphone',
  'camera',
  'bike',
  'tool',
  'furniture',
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const SUPPORTED_CATEGORIES = ['vehicle'] as const satisfies readonly ListingCategory[];

export type SupportedCategory = (typeof SUPPORTED_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  vehicle: 'Autos',
  electronics: 'Elektronik',
  computer: 'PCs & Computer',
  smartphone: 'Smartphones',
  camera: 'Kameras',
  bike: 'Fahrräder',
  tool: 'Werkzeug',
  furniture: 'Möbel',
};

export function isSupportedCategory(category: ListingCategory): category is SupportedCategory {
  return (SUPPORTED_CATEGORIES as readonly ListingCategory[]).includes(category);
}
