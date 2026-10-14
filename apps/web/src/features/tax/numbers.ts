/**
 * A number as typed: „1.530“ (thousands separator) or „1530“; a decimal comma
 * or point stays a decimal, also while it is being typed („12,“). Empty or
 * invalid input counts as „not given“.
 */
export function toNumber(value: string): number | null {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?!\d))/g, '')
    .replace(',', '.');
  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  return Number(normalized);
}

/**
 * A decimal as typed, for small values such as prices or consumption: both
 * „1,799“ and „1.799“ mean 1.799, never 1799; „,35“ and „1,“ (while typing)
 * are fine too.
 */
export function toDecimal(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  return Number(normalized);
}
