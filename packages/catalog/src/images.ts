import { z } from 'zod';
import data from '../data/model-images.json';

/**
 * One photo per generation from Wikimedia Commons, served from our own
 * server (see scripts/fetch-images.ts), with what its licence asks us to
 * name: title, author, licence, the file page and what we changed.
 */
const ImagesSchema = z.object({
  retrieved: z.string(),
  images: z.record(
    z.string(),
    z.object({
      file: z.string(),
      title: z.string(),
      author: z.string(),
      license: z.string(),
      licenseUrl: z.string().nullable(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      /** Boxes of the number plates that were pixelated. */
      plates: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])).optional(),
    }),
  ),
});

const IMAGES = ImagesSchema.parse(data);

export interface GenerationImage {
  /** Path on our server. */
  src: string;
  width: number;
  height: number;
  title: string;
  author: string;
  /** The licence's name, in German where it has one: „CC BY-SA 3.0 DE“, „gemeinfrei“. */
  license: string;
  /** The licence in German, where there is a page for it. */
  licenseUrl: string | null;
  /** Number plates were made unreadable. */
  platesHidden: boolean;
  /** „Share alike“: a changed copy is under the same licence, which the credit says. */
  shareAlike: boolean;
  /** The file page on Wikimedia Commons. */
  source: string;
}

const LICENSE_NAMES: Record<string, string> = {
  'public domain': 'gemeinfrei',
  attribution: 'frei mit Namensnennung',
};

/** „CC BY-SA 3.0 de“ → „CC BY-SA 3.0 DE“; Commons' own names in German. */
export function licenseName(license: string): string {
  return (
    LICENSE_NAMES[license.toLowerCase()] ??
    license.replace(/ ([a-z]{2})$/, (_, port: string) => ` ${port.toUpperCase()}`)
  );
}

/** A Creative Commons licence links to its German summary; other links stay as they are. */
export function germanDeed(url: string | null): string | null {
  const match = url?.match(
    /^https?:\/\/creativecommons\.org\/((?:licenses|publicdomain)\/[a-z-]+\/\d\.\d(?:\/[a-z]{2})?)(?:\/(?:deed\.[a-z-]+)?)?$/i,
  );
  return match ? `https://creativecommons.org/${match[1]}/deed.de` : url;
}

export function generationImage(generationId: string): GenerationImage | null {
  const image = IMAGES.images[generationId];
  if (!image) return null;
  return {
    src: `/model-images/${generationId}.webp`,
    width: image.width,
    height: image.height,
    title: image.title,
    author: image.author,
    license: licenseName(image.license),
    licenseUrl: germanDeed(image.licenseUrl),
    platesHidden: (image.plates?.length ?? 0) > 0,
    shareAlike: /^CC BY-SA /i.test(image.license),
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(image.file.replaceAll(' ', '_'))}`,
  };
}
