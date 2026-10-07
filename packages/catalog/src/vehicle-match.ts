import { MAKES, type Make } from './makes';
import { findModel, foldName, modelsOfMake, type ModelEntry } from './models';

/** The catalog make named in a listing ("VW", "Mercedes-Benz", "Skoda"). */
export function findMake(text: string | null | undefined): Make | null {
  const wanted = foldName(text ?? '');
  if (!wanted) return null;
  return (
    MAKES.find((make) =>
      [make.id, make.name, make.platformSlug].some((name) => foldName(name) === wanted),
    ) ?? null
  );
}

/** Model names that listings write as type designations ("320d", "C 220 d"). */
function fromDesignation(make: Make, wanted: string): string | null {
  if (make.id === 'bmw') {
    const series = /^(\d)\d{2}[a-z]*\b/.exec(wanted)?.[1];
    if (!series) return null;
    if (series !== '2') return `${series}er`;
    return /\b(?:active|gran) tourer\b/.test(wanted) ? '2er active tourer' : '2er coupe';
  }
  if (make.id === 'mercedes') {
    const letter = /^([abcegsv]) ?\d{2,3}\b/.exec(wanted)?.[1];
    return letter ? `${letter} klasse` : null;
  }
  return null;
}

/**
 * The catalog model of a listing: the model as named ("Golf"), a longer
 * name that starts with it ("Golf Variant 1.4 TSI") or a type designation.
 */
export function findListingModel(
  make: Make | null,
  text: string | null | undefined,
): ModelEntry | null {
  if (!make || !text) return null;
  const exact = findModel(make.id, text);
  if (exact) return exact;
  const wanted = foldName(text);
  const models = modelsOfMake(make.id);
  const designation = fromDesignation(make, wanted);
  if (designation) {
    const match = models.find((model) => {
      const name = foldName(model.model);
      return name === designation || name.startsWith(`${designation} `);
    });
    if (match) return match;
  }
  let best: ModelEntry | null = null;
  let bestLength = 0;
  for (const model of models) {
    for (const name of [model.model, ...(model.aliases ?? [])]) {
      const folded = foldName(name);
      if (folded.length > bestLength && wanted.startsWith(`${folded} `)) {
        best = model;
        bestLength = folded.length;
      }
    }
  }
  return best;
}
