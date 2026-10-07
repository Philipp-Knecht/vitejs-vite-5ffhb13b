import { makeById, modelById, parseSearchParams, type SearchQuery } from '@kaufcheck/catalog';
import { formatNumber } from '../../lib/format';

export const isModelId = (id: string) => modelById(id) !== null;

/** "VW Golf · bis 15.000 € · ab 2016 · bis 120.000 km" */
export function describeSearch(query: SearchQuery): string {
  const make = makeById(query.makeId);
  const model = modelById(query.modelId);
  const parts = [
    [make?.name, model?.model ?? query.modelText].filter(Boolean).join(' ') || 'Alle Marken',
    query.priceMax !== null ? `bis ${formatNumber(query.priceMax)} €` : null,
    query.priceMin !== null ? `ab ${formatNumber(query.priceMin)} €` : null,
    query.yearMin !== null ? `ab ${query.yearMin}` : null,
    query.yearMax !== null ? `bis Baujahr ${query.yearMax}` : null,
    query.kmMax !== null ? `bis ${formatNumber(query.kmMax)} km` : null,
    query.zip ? `${query.radiusKm ?? 50} km um ${query.zip}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** A saved search's parameters, described the same way. */
export const describeSavedQuery = (query: string) =>
  describeSearch(parseSearchParams(new URLSearchParams(query), isModelId));
