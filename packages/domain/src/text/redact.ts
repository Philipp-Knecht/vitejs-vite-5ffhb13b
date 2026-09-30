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

export function redactContactData(text: string): string {
  return text
    .replace(EMAIL, REDACTED_EMAIL)
    .replace(IBAN, REDACTED_IBAN)
    .replace(PHONE_CANDIDATE, (match) => (looksLikePhoneNumber(match) ? REDACTED_PHONE : match));
}
