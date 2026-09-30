import { parse, type HTMLElement } from 'node-html-parser';
import { isAllowedImageUrl, type ListingAttribute, type ListingImage } from '@kaufcheck/shared';
import { cleanInline, cleanText, uniqueBy } from '../text/text';
import { emptyParsedListing, stripTitleMarkers, type ParsedListing } from './parsed-listing';
import { parseListingText } from './parse-listing-text';

/**
 * Extracts listing data from a Kleinanzeigen listing page.
 *
 * The page structure is not a public contract and can change. Extraction is
 * therefore layered: known page elements first, then schema.org/JSON-LD and
 * Open Graph metadata, and finally the label/value text parser on the
 * visible page text. Missing values stay `null` – nothing is guessed.
 */

const MAX_IMAGES = 20;
const MAX_EQUIPMENT = 80;

function text(element: HTMLElement | null | undefined): string | null {
  if (!element) return null;
  const value = cleanInline(element.text);
  return value.length > 0 ? value : null;
}

function multilineText(element: HTMLElement | null | undefined): string | null {
  if (!element) return null;
  const withBreaks = element.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n');
  const value = cleanText(parse(withBreaks).text);
  return value.length > 0 ? value : null;
}

function meta(root: HTMLElement, key: string): string | null {
  const element =
    root.querySelector(`meta[property="${key}"]`) ?? root.querySelector(`meta[name="${key}"]`);
  const content = element?.getAttribute('content');
  return content ? cleanInline(content) || null : null;
}

function extractDetails(root: HTMLElement): ListingAttribute[] {
  const attributes: ListingAttribute[] = [];
  for (const item of root.querySelectorAll('.addetailslist--detail')) {
    const valueElement = item.querySelector('.addetailslist--detail--value');
    const value = text(valueElement);
    const full = text(item);
    if (!value || !full) continue;
    const label = (full.endsWith(value) ? full.slice(0, -value.length) : full.replace(value, ''))
      .replace(/[:：]\s*$/, '')
      .trim();
    if (label.length === 0 || label.length > 60 || value.length > 200) continue;
    attributes.push({ label, value });
  }
  return attributes;
}

function extractEquipment(root: HTMLElement): string[] {
  const tags = root
    .querySelectorAll('.checktaglist .checktag, #viewad-configuration .checktag')
    .map((element) => text(element))
    .filter((value): value is string => value !== null && value.length <= 80);
  return uniqueBy(tags, (tag) => tag.toLowerCase()).slice(0, MAX_EQUIPMENT);
}

function imageFromUrl(raw: string | undefined | null): ListingImage | null {
  if (!raw) return null;
  const url = raw.trim().replace(/^\/\//, 'https://');
  if (!isAllowedImageUrl(url)) return null;
  return { url, thumbnailUrl: null };
}

function extractImages(root: HTMLElement, jsonLdImages: string[]): ListingImage[] {
  const candidates: (string | undefined)[] = [];
  for (const element of root.querySelectorAll(
    '#viewad-image, .galleryimage-element img, #viewad-thumbnail-list img, .imagebox-thumbnail img',
  )) {
    candidates.push(
      element.getAttribute('data-imgsrc') ??
        element.getAttribute('data-src') ??
        element.getAttribute('src'),
    );
  }
  candidates.push(...jsonLdImages);
  candidates.push(meta(root, 'og:image') ?? undefined);

  const images = candidates
    .map((candidate) => imageFromUrl(candidate))
    .filter((image): image is ListingImage => image !== null);
  // The same photo appears in several sizes; compare without the size rule.
  return uniqueBy(images, (image) => image.url.split('?')[0] ?? image.url).slice(0, MAX_IMAGES);
}

interface JsonLdData {
  name: string | null;
  description: string | null;
  price: string | null;
  images: string[];
  attributes: ListingAttribute[];
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return cleanInline(value) || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function extractJsonLd(root: HTMLElement): JsonLdData {
  const result: JsonLdData = {
    name: null,
    description: null,
    price: null,
    images: [],
    attributes: [],
  };
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.rawText);
    } catch {
      continue;
    }
    const nodes = asArray(data).flatMap((node) =>
      node && typeof node === 'object' && '@graph' in node ? asArray(node['@graph']) : [node],
    );
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const record = node as Record<string, unknown>;
      const types = asArray(record['@type']).map((t) => String(t).toLowerCase());
      if (
        !types.some((t) => ['product', 'car', 'vehicle', 'offer', 'individualproduct'].includes(t))
      ) {
        continue;
      }
      result.name ??= stringValue(record.name);
      result.description ??=
        typeof record.description === 'string' ? cleanText(record.description) : null;
      for (const image of asArray(record.image)) {
        const url =
          typeof image === 'string' ? image : stringValue((image as { url?: unknown })?.url);
        if (url) result.images.push(url);
      }
      for (const offer of asArray(record.offers)) {
        if (offer && typeof offer === 'object') {
          const price = stringValue((offer as Record<string, unknown>).price);
          if (price && !result.price) result.price = `${price} €`;
        }
      }
      const mileage = record.mileageFromOdometer as Record<string, unknown> | undefined;
      const mileageValue = stringValue(mileage?.value);
      if (mileageValue)
        result.attributes.push({ label: 'Kilometerstand', value: `${mileageValue} km` });
      const brand = record.brand as Record<string, unknown> | string | undefined;
      const brandName = typeof brand === 'string' ? brand : stringValue(brand?.name);
      if (brandName) result.attributes.push({ label: 'Marke', value: brandName });
      const simple: [string, string][] = [
        ['model', 'Modell'],
        ['fuelType', 'Kraftstoffart'],
        ['vehicleTransmission', 'Getriebe'],
        ['dateVehicleFirstRegistered', 'Erstzulassung'],
        ['color', 'Außenfarbe'],
      ];
      for (const [key, label] of simple) {
        const value = stringValue(record[key]);
        if (value) result.attributes.push({ label, value });
      }
    }
  }
  return result;
}

function extractBreadcrumb(root: HTMLElement): string[] {
  return root
    .querySelectorAll(
      '#vap-brdcrmb a, .breadcrump-link, .breadcrumb a, [itemprop="itemListElement"] [itemprop="name"]',
    )
    .map((element) => text(element))
    .filter((value): value is string => value !== null && value.length <= 60);
}

function extractSellerType(root: HTMLElement, pageText: string): string | null {
  const box = text(
    root.querySelector('#viewad-contact, .userprofile-vip-details-text, #viewad-profile-box'),
  );
  const haystack = `${box ?? ''}\n${pageText}`;
  const match =
    /(gewerblicher?\s+(?:nutzer|anbieter|händler)|privater?\s+(?:nutzer|anbieter))/i.exec(haystack);
  return match?.[1] ? cleanInline(match[1]) : null;
}

function extractExternalId(root: HTMLElement, pageText: string): string | null {
  const box = text(root.querySelector('#viewad-ad-id-box'));
  const match = /anzeigen-?id\s*:?\s*(\d{6,12})/i.exec(`${box ?? ''}\n${pageText}`);
  return match?.[1] ?? null;
}

export function parseKleinanzeigenHtml(html: string): ParsedListing {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, noscript: false, style: false, pre: true },
  });
  const result = emptyParsedListing();

  // Visible page text for label-based fallbacks (scripts and styles removed).
  const bodyClone = parse(root.querySelector('body')?.innerHTML ?? root.innerHTML, {
    comment: false,
    blockTextElements: { script: false, noscript: false, style: false, pre: true },
  });
  bodyClone
    .querySelectorAll('script, style, noscript, template')
    .forEach((element) => element.remove());
  const pageText = cleanText(bodyClone.structuredText);

  const jsonLd = extractJsonLd(root);

  const rawTitle =
    text(root.querySelector('#viewad-title')) ??
    jsonLd.name ??
    meta(root, 'og:title') ??
    text(root.querySelector('title'))?.replace(/\s*[|–-]\s*(?:ebay\s+)?kleinanzeigen.*$/i, '') ??
    null;
  if (rawTitle) {
    const { title, status } = stripTitleMarkers(rawTitle);
    result.title = title || null;
    result.status = status;
  }

  result.priceText =
    text(root.querySelector('#viewad-price')) ??
    (root.querySelector('meta[itemprop="price"]')?.getAttribute('content')
      ? `${root.querySelector('meta[itemprop="price"]')?.getAttribute('content')} €`
      : null) ??
    jsonLd.price;

  result.locationText = text(root.querySelector('#viewad-locality'));
  const extraInfo = text(root.querySelector('#viewad-extra-info'));
  const dateMatch = extraInfo ? /(\d{2}\.\d{2}\.\d{4}|heute|gestern)/i.exec(extraInfo) : null;
  result.postedAtText = dateMatch?.[1] ?? null;

  result.attributes = extractDetails(root);
  result.equipment = extractEquipment(root);
  result.description =
    multilineText(root.querySelector('#viewad-description-text')) ??
    multilineText(root.querySelector('[itemprop="description"]')) ??
    jsonLd.description ??
    meta(root, 'og:description');

  result.images = extractImages(root, jsonLd.images);
  result.categoryHints = extractBreadcrumb(root);
  result.sellerTypeText = extractSellerType(root, pageText);
  const memberSince = /aktiv\s+seit\s+(\d{2}\.\d{2}\.\d{4})/i.exec(pageText);
  result.memberSinceText = memberSince?.[1] ?? null;
  result.externalId = extractExternalId(root, pageText);

  // Fallback: when the known page elements are missing, use the text parser
  // on the visible page text. It only fills gaps; it never overrides.
  if (result.attributes.length === 0 || !result.priceText || !result.title) {
    const fromText = parseListingText(pageText);
    if (result.attributes.length === 0) result.attributes = fromText.attributes;
    if (result.attributes.length === 0 && jsonLd.attributes.length > 0) {
      result.attributes = jsonLd.attributes;
    }
    result.priceText ??= fromText.priceText;
    result.title ??= fromText.title;
    result.locationText ??= fromText.locationText;
    result.postedAtText ??= fromText.postedAtText;
    if (result.equipment.length === 0) result.equipment = fromText.equipment;
    result.description ??= fromText.description;
  }

  if (!result.status && /\bgelöscht\b/i.test(extraInfo ?? '')) result.status = 'deleted';
  result.status ??= 'active';
  return result;
}
