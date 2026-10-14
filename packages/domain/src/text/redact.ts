import { findVins, isPlausibleVin } from '@kaufcheck/shared';

/**
 * Removes contact and payment data from listing text before it is stored or
 * sent to an AI provider (data minimisation). The analysis never needs it.
 */

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
// Not preceded by a digit or decimal separator; not followed by a digit or a decimal part (",5").
const PHONE_CANDIDATE =
  /(?<![\p{N}.,])(?:(?:\+|00)\s?\d{2}[\s\-/.]*)?\(?0?\d{2,5}\)?(?:[\s\-/.]*\d{2,}){1,5}(?!\p{N}|,\d)/gu;

export const REDACTED_PHONE = '[Telefonnummer entfernt]';
export const REDACTED_EMAIL = '[E-Mail entfernt]';
export const REDACTED_IBAN = '[IBAN entfernt]';

function looksLikePhoneNumber(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return false;
  const trimmed = candidate.trim();
  // German numbers start with 0, +49 or 0049; bare large numbers (mileage, prices) do not.
  if (!/^(?:\+|00|\(?0)/.test(trimmed)) return false;
  // Dates like 01.05.2012 or 01.05.2012 - 01.06.2012 are not phone numbers.
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(trimmed)) return false;
  return true;
}

/** ISO 13616 check: the rearranged number modulo 97 is 1. */
function hasIbanChecksum(candidate: string): boolean {
  const compact = candidate.replace(/ /g, '').toUpperCase();
  let remainder = 0;
  for (const char of compact.slice(4) + compact.slice(0, 4)) {
    const value = Number.parseInt(char, 36);
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  return remainder === 1;
}

/**
 * A candidate that is no phone number may still have swallowed one, e.g.
 * „Baujahr 2018 0171 1234567“: then the rest after its first group is checked again.
 */
function redactPhones(text: string): string {
  return text.replace(PHONE_CANDIDATE, (match: string) => {
    if (looksLikePhoneNumber(match)) return REDACTED_PHONE;
    const cut = match.search(/[\s\-/.]/);
    return cut > 0 ? match.slice(0, cut) + redactPhones(match.slice(cut)) : match;
  });
}

export function redactContactData(text: string): string {
  const redacted = text
    .replace(EMAIL, REDACTED_EMAIL)
    // A FIN such as VF33C9HZC84123456 has the shape of an IBAN but no valid checksum.
    .replace(IBAN, (match) =>
      isPlausibleVin(match) && !hasIbanChecksum(match) ? match : REDACTED_IBAN,
    );
  // Phone numbers are searched between FINs only: digits of a FIN (W0L0XCF0844012345) are
  // no phone number, and a phone number right after a FIN is still found.
  let out = '';
  let last = 0;
  for (const { index } of findVins(redacted)) {
    out += redactPhones(redacted.slice(last, index)) + redacted.slice(index, index + 17);
    last = index + 17;
  }
  return out + redactPhones(redacted.slice(last));
}
