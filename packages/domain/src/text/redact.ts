/**
 * Removes contact and payment data from listing text before it is stored or
 * sent to an AI provider (data minimisation). The analysis never needs it.
 */

// The local part starts at a boundary, so that long runs without „@“ are scanned once.
const EMAIL =
  /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;

/**
 * Runs of digit groups joined by one separator (space, „-“, „/“ or „.“) – the
 * shape of a phone number, but also of prices, dates and mileages. A group may
 * be „+49“, „(0)171“ or „(0171)“. Every group is followed by a mandatory
 * separator, so the pattern cannot split a digit run in many ways (it runs in
 * linear time even on long digit runs).
 */
const GROUP = String.raw`[+(]?\d+(?:\)\d*)?`;
const NUMBER_RUN = new RegExp(String.raw`${GROUP}(?:(?:[ \t]*[-/.][ \t]*|[ \t]+)${GROUP})*`, 'g');
const GROUP_IN_RUN = new RegExp(GROUP, 'g');
export const REDACTED_PHONE = '[Telefonnummer entfernt]';
export const REDACTED_EMAIL = '[E-Mail entfernt]';
export const REDACTED_IBAN = '[IBAN entfernt]';

const digitCount = (text: string) => text.replace(/\D/g, '').length;

/** German numbers start with 0, +49 or 0049 („000“ is no area code). */
const startsPhoneNumber = (group: string) =>
  /^(?:\+[1-9]|00[1-9]|\(?0)/.test(group) && /[1-9]/.test(group);

function looksLikePhoneNumber(candidate: string): boolean {
  const digits = digitCount(candidate);
  if (digits < 9 || digits > 15) return false;
  // Dates like 01.05.2012 and month/year values like 06/2019 are no phone numbers.
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(candidate)) return false;
  if (/(?:^|[\s-])\d{1,2}[./](?:19|20)\d{2}(?!\d)/.test(candidate)) return false;
  return true;
}

/**
 * Within a run of digit groups, each phone number starts at a group like
 * „0171“, „+49“ or „(0)“ and takes the following groups up to 15 digits – once
 * it has 9 digits it stops before a group that starts a new number. Groups
 * before and after it (a year, a mileage) stay.
 */
function redactPhonesInRun(run: string): string {
  const groups = [...run.matchAll(GROUP_IN_RUN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  }));
  let out = '';
  let kept = 0;
  let i = 0;
  while (i < groups.length) {
    const first = groups[i]!;
    let found = -1;
    if (startsPhoneNumber(first.text)) {
      let digits = 0;
      for (let j = i; j < groups.length; j++) {
        const group = groups[j]!;
        if (j > i && digits >= 9 && startsPhoneNumber(group.text)) break;
        digits += digitCount(group.text);
        if (digits > 15) break;
        if (looksLikePhoneNumber(run.slice(first.start, group.end))) found = j;
      }
    }
    if (found >= 0) {
      out += run.slice(kept, first.start) + REDACTED_PHONE;
      kept = groups[found]!.end;
      i = found + 1;
    } else {
      i++;
    }
  }
  return out + run.slice(kept);
}

export function redactContactData(text: string): string {
  return (
    text
      .replace(EMAIL, REDACTED_EMAIL)
      .replace(IBAN, REDACTED_IBAN)
      // Digits glued to a letter belong to a code (a FIN like W0L0XCF0844012345, a part number).
      .replace(NUMBER_RUN, (run: string, offset: number, whole: string) =>
        /\p{L}/u.test(whole.charAt(offset - 1)) ? run : redactPhonesInRun(run),
      )
  );
}
