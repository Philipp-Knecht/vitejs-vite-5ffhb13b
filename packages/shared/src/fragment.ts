/**
 * The element id in a URL fragment („#typklasse“ → „typklasse“). A malformed
 * escape such as „#100%“ is taken as it is instead of throwing.
 */
export function fragmentId(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
