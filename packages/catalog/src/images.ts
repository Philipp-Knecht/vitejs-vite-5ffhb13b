import { z } from 'zod';
import data from '../data/model-images.json';

/**
 * One photo per generation from Wikimedia Commons, served from our own
 * server (see scripts/fetch-images.ts), with what its licence asks us to
 * name: author, licence and the file page.
 */
const ImagesSchema = z.object({
  retrieved: z.string(),
  images: z.record(
    z.string(),
    z.object({
      file: z.string(),
      author: z.string(),
      license: z.string(),
      licenseUrl: z.string().nullable(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  ),
});

const IMAGES = ImagesSchema.parse(data);

export interface GenerationImage {
  /** Path on our server. */
  src: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl: string | null;
  /** The file page on Wikimedia Commons. */
  source: string;
}

export function generationImage(generationId: string): GenerationImage | null {
  const image = IMAGES.images[generationId];
  if (!image) return null;
  return {
    src: `/model-images/${generationId}.webp`,
    width: image.width,
    height: image.height,
    author: image.author,
    license: image.license,
    licenseUrl: image.licenseUrl,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(image.file.replaceAll(' ', '_'))}`,
  };
}
