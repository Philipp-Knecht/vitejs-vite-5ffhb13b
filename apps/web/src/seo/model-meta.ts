import type { CarModel } from '@kaufcheck/catalog';
import type { PageMeta } from './pages';

export function modelPageMeta(model: CarModel): PageMeta {
  const name = `${model.make} ${model.model}`;
  return {
    title: `${name} gebraucht kaufen: Schwachstellen, Motoren, Tipps | KaufCheck`,
    description: `${name} gebraucht: bekannte Schwachstellen je Generation mit Quelle, empfehlenswerte Motoren und worauf du bei der Besichtigung achten musst.`,
  };
}
