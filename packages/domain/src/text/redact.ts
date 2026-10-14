/**
 * Removes contact and payment data from listing text before it is stored or
 * sent to an AI provider (data minimisation). The analysis never needs it.
 */

// The local part starts at a boundary, so that long runs without „@“ are scanned once.
const EMAIL =
  /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g;
const WHATSAPP_LINK = /(wa\.me\/)\+?\d{6,15}/gi;

/**
 * Runs of digit groups joined by one separator (spaces, a hyphen or dash, „/“
 * or „.“, not a line break) – the shape of a phone number, but also of prices,
 * dates and mileages. A group may be „+49“, „+49(0)171“, „+49(171)“ or
 * „(0171)“. Every group is followed by a mandatory separator, so the pattern
 * cannot split a digit run in many ways (it runs in linear time even on long
 * digit runs).
 */
const GROUP = String.raw`(?:\+[^\S\n]?)?\d+(?:\(\d+\)\d*)?|\(\+?\d+\)\d*`;
const SEPARATOR = String.raw`[^\S\n]*[-‐‑‒–—−/.][^\S\n]*|[^\S\n]+`;
const NUMBER_RUN = new RegExp(String.raw`(?:${GROUP})(?:(?:${SEPARATOR})(?:${GROUP}))*`, 'g');
const GROUP_IN_RUN = new RegExp(GROUP, 'g');

export const REDACTED_PHONE = '[Telefonnummer entfernt]';
export const REDACTED_EMAIL = '[E-Mail entfernt]';
export const REDACTED_IBAN = '[IBAN entfernt]';

const digitCount = (text: string) => text.replace(/\D/g, '').length;

/** German numbers start with 0, +49 (also „+ 49“, „+0171“) or 0049 („000“ is no area code). */
const startsPhoneNumber = (group: string) =>
  /^\(?(?:\+\s?0?[1-9]|00[1-9]|0)/.test(group) && (/[1-9]/.test(group) || group === '(0)');

/** „1.4“, „120.000“, „12/2019“: groups joined without spaces belong together. */
const isCompactJoin = (separator: string) => /^[./]$/.test(separator);

function looksLikePhoneNumber(candidate: string): boolean {
  const digits = digitCount(candidate);
  if (digits < 9 || digits > 15) return false;
  // Dates like 01.05.2012 or 2012-05-01 and month/year values like 06/2019 are no phone numbers.
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(candidate)) return false;
  if (/(?:^|[\s–—-])\d{1,2}[./](?:19|20)\d{2}(?!\d)/.test(candidate)) return false;
  if (/(?:^|\D)(?:19|20)\d{2}-\d{1,2}(?!\d)/.test(candidate)) return false;
  return true;
}

/**
 * Within a run of digit groups, each phone number starts at a group like
 * „0171“, „+49“ or „(0)“ and takes the following groups up to 15 digits. It
 * ends before a group that starts a new number, and once it has 9 digits also
 * before a token like „120.000“ or „12/2019“ that follows after a space; it
 * never ends inside such a token. A complete number („0171 1234567“) does not
 * take a following value („2 Vorbesitzer“, „2019“). Groups before and after it
 * stay; a first group glued to a code with digits („A4“, a FIN) never starts a
 * number.
 */
function redactPhonesInRun(run: string, gluedToCode: boolean): string {
  const groups = [...run.matchAll(GROUP_IN_RUN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  }));
  const separatorAfter = (index: number) =>
    index >= 0 && index + 1 < groups.length
      ? run.slice(groups[index]!.end, groups[index + 1]!.start)
      : '';
  /** Index of the last group of the phone number starting at group `i`, or -1. */
  const endOf = (i: number): number => {
    const first = groups[i]!;
    if (!startsPhoneNumber(first.text)) return -1;
    const national = /^\(?0[1-9]/.test(first.text);
    let found = -1;
    let digits = 0;
    for (let j = i; j < groups.length; j++) {
      const group = groups[j]!;
      if (j > i) {
        const spaced = /\s/.test(separatorAfter(j - 1));
        const last = digitCount(groups[j - 1]!.text);
        // „0171 1234567/0172 7654321“: the next number ends this one.
        if (digits >= 9 && startsPhoneNumber(group.text)) {
          if (looksLikePhoneNumber(run.slice(first.start, groups[j - 1]!.end))) found = j - 1;
          break;
        }
        // A token like „120.000“ after a space is the next value, not the number.
        if (digits >= 9 && spaced && isCompactJoin(separatorAfter(j))) break;
        // Complete: a national number with 11 digits, or one ending with a subscriber block of
        // 4+ digits („0171 1234567“, not „+49 171 123 45“).
        const complete =
          found === j - 1 &&
          ((national && digits >= 11) ||
            (digits >= 11 && last >= 4) ||
            (digits >= 10 && last >= 5));
        if (spaced && complete) break;
      }
      digits += digitCount(group.text);
      if (digits > 15) break;
      const endsToken = !isCompactJoin(separatorAfter(j));
      if (endsToken && looksLikePhoneNumber(run.slice(first.start, group.end))) found = j;
    }
    return found;
  };
  let out = '';
  let kept = 0;
  let i = gluedToCode ? 1 : 0;
  while (i < groups.length) {
    let start = i;
    let found = endOf(i);
    // „PLZ 01067 0171 1234567“: a later start that reaches further wins (at most 15 groups).
    for (let k = i + 1; found >= 0 && k <= found; k++) {
      const later = endOf(k);
      if (later > found) {
        start = k;
        found = later;
      }
    }
    if (found >= 0) {
      out += run.slice(kept, groups[start]!.start) + REDACTED_PHONE;
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
      .replace(WHATSAPP_LINK, `$1${REDACTED_PHONE}`)
      // Digits glued to a code with digits (a FIN, „A4“) are not a number's start; after a
      // plain word („Tel0171 …“) they are.
      .replace(NUMBER_RUN, (run: string, offset: number, whole: string) =>
        redactPhonesInRun(
          run,
          /\p{L}/u.test(whole.charAt(offset - 1)) &&
            /\p{N}/u.test(
              /[\p{L}\p{N}]*$/u.exec(whole.slice(Math.max(0, offset - 20), offset))![0],
            ),
        ),
      )
  );
}
