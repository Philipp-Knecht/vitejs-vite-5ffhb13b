import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generationImage, germanDeed, licenseName } from './images';
import { ALL_KNOWLEDGE } from './knowledge-eager';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../../apps/web/public');
const read = (file: string) =>
  JSON.parse(readFileSync(path.resolve(here, '../data', file), 'utf8')) as unknown;
type Box = [number, number, number, number];
const sources = Object.fromEntries(
  Object.entries(
    read('model-image-sources.json') as Record<string, string | { file: string; plates: Box[] }>,
  ).map(([id, source]) => [id, typeof source === 'string' ? { file: source, plates: [] } : source]),
);
const images = (
  read('model-images.json') as {
    images: Record<
      string,
      {
        file: string;
        title: string;
        license: string;
        author: string;
        width: number;
        height: number;
        plates?: Box[];
      }
    >;
  }
).images;
const generationIds = new Set(ALL_KNOWLEDGE.flatMap((model) => model.generations.map((g) => g.id)));

describe('generation photos', () => {
  it('belong to researched generations, one fetched file per chosen one', () => {
    for (const id of Object.keys(sources)) expect(generationIds, id).toContain(id);
    expect(Object.keys(images).sort()).toEqual(Object.keys(sources).sort());
    for (const [id, image] of Object.entries(images)) {
      expect(image.file, id).toBe(sources[id]?.file);
      expect(existsSync(path.join(publicDir, 'model-images', `${id}.webp`)), id).toBe(true);
    }
  });

  it('only carry free licences and always name a title and an author', () => {
    for (const [id, image] of Object.entries(images)) {
      expect(image.license, id).toMatch(
        /^(CC BY(-SA)? \d\.\d( [a-z]{2})?|CC0|Public domain|Attribution)$/i,
      );
      expect(image.title.trim(), id).not.toBe('');
      expect(image.author.trim(), id).not.toBe('');
      expect(`${image.title} ${image.author}`, id).not.toMatch(/<|\(UTC\)/);
    }
  });

  it('have the listed number plates pixelated, inside the photo', () => {
    for (const [id, image] of Object.entries(images)) {
      const plates = sources[id]?.plates ?? [];
      expect(image.plates ?? [], id).toEqual(plates);
      expect(generationImage(id)?.platesHidden, id).toBe(plates.length > 0);
      expect(generationImage(id)?.shareAlike, id).toBe(image.license.startsWith('CC BY-SA'));
      for (const [x, y, w, h] of plates) {
        expect(x + w, id).toBeLessThanOrEqual(image.width);
        expect(y + h, id).toBeLessThanOrEqual(image.height);
      }
    }
  });

  it('link the credit to the file page on Wikimedia Commons', () => {
    const image = generationImage('vw-golf-7');
    expect(image?.src).toBe('/model-images/vw-golf-7.webp');
    // Dash, comma and umlaut of the file name, encoded.
    expect(image?.source).toBe(
      'https://commons.wikimedia.org/wiki/File:VW_Golf_1.4_TSI_BlueMotion_Technology_CUP_(VII)_%E2%80%93_Frontansicht%2C_15._Juni_2014%2C_D%C3%BCsseldorf.jpg',
    );
    expect(generationImage('no-such-generation')).toBeNull();
  });

  it('name the licence in German and link its German summary', () => {
    expect(licenseName('CC BY-SA 3.0 de')).toBe('CC BY-SA 3.0 DE');
    expect(licenseName('CC BY 2.0')).toBe('CC BY 2.0');
    expect(licenseName('Public domain')).toBe('gemeinfrei');
    expect(licenseName('Attribution')).toBe('frei mit Namensnennung');
    expect(germanDeed('https://creativecommons.org/licenses/by-sa/3.0/de/deed.en')).toBe(
      'https://creativecommons.org/licenses/by-sa/3.0/de/deed.de',
    );
    expect(germanDeed('http://creativecommons.org/licenses/by-sa/3.0/')).toBe(
      'https://creativecommons.org/licenses/by-sa/3.0/deed.de',
    );
    expect(germanDeed('https://creativecommons.org/licenses/by/4.0')).toBe(
      'https://creativecommons.org/licenses/by/4.0/deed.de',
    );
    expect(germanDeed('http://creativecommons.org/publicdomain/zero/1.0/deed.en')).toBe(
      'https://creativecommons.org/publicdomain/zero/1.0/deed.de',
    );
    expect(germanDeed('https://example.org/licence')).toBe('https://example.org/licence');
    expect(germanDeed(null)).toBeNull();
  });
});
