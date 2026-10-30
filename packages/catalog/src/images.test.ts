import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generationImage } from './images';
import { ALL_KNOWLEDGE } from './knowledge-eager';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../../apps/web/public');
const read = (file: string) =>
  JSON.parse(readFileSync(path.resolve(here, '../data', file), 'utf8')) as unknown;
const sources = read('model-image-sources.json') as Record<string, string>;
const images = (
  read('model-images.json') as {
    images: Record<string, { file: string; license: string; author: string }>;
  }
).images;
const generationIds = new Set(ALL_KNOWLEDGE.flatMap((model) => model.generations.map((g) => g.id)));

describe('generation photos', () => {
  it('belong to researched generations, one fetched file per chosen one', () => {
    for (const id of Object.keys(sources)) expect(generationIds, id).toContain(id);
    expect(Object.keys(images).sort()).toEqual(Object.keys(sources).sort());
    for (const [id, image] of Object.entries(images)) {
      expect(image.file, id).toBe(sources[id]);
      expect(existsSync(path.join(publicDir, 'model-images', `${id}.webp`)), id).toBe(true);
    }
  });

  it('only carry free licences and always name an author', () => {
    for (const [id, image] of Object.entries(images)) {
      expect(image.license, id).toMatch(
        /^(CC BY(-SA)? \d\.\d( [a-z]{2})?|CC0|Public domain|Attribution)$/i,
      );
      expect(image.author.trim(), id).not.toBe('');
      expect(image.author, id).not.toMatch(/<|\(UTC\)/);
    }
  });

  it('link the credit to the file page on Wikimedia Commons', () => {
    const image = generationImage('vw-golf-7');
    expect(image?.src).toBe('/model-images/vw-golf-7.webp');
    expect(image?.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:VW_Golf_/);
    expect(generationImage('no-such-generation')).toBeNull();
  });
});
