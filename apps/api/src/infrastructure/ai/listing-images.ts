import { LISTING_IMAGE_HOSTS, type ListingImage } from '@kaufcheck/shared';
import { safeFetch, type Resolver } from '../net/safe-fetch';
import type { AiImageInput } from './types';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(LISTING_IMAGE_HOSTS);

export interface DownloadedImage extends AiImageInput {
  /** Index of the image in the listing's image list. */
  listingIndex: number;
}

/**
 * Downloads listing photos for vision analysis through the SSRF-safe
 * fetcher (image CDN allowlist, size and type limits). Failed images are
 * skipped; the returned order defines the indices the model refers to.
 */
export async function downloadListingImages(
  images: readonly ListingImage[],
  options: {
    max: number;
    userAgent: string;
    timeoutMs: number;
    signal?: AbortSignal;
    resolver?: Resolver;
  },
): Promise<DownloadedImage[]> {
  const selected = images.slice(0, options.max);
  const results = await Promise.all(
    selected.map(async (image, listingIndex): Promise<DownloadedImage | null> => {
      try {
        const response = await safeFetch(image.url, {
          allowedHosts: ALLOWED_HOSTS,
          userAgent: options.userAgent,
          timeoutMs: options.timeoutMs,
          maxBytes: 3_500_000,
          contentTypes: IMAGE_TYPES,
          signal: options.signal,
          resolver: options.resolver,
        });
        const mediaType = IMAGE_TYPES.find((type) => type === response.contentType);
        if (response.status !== 200 || !mediaType) return null;
        return { listingIndex, mediaType, data: response.body.toString('base64') };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((image): image is DownloadedImage => image !== null);
}
