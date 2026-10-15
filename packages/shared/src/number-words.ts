const ONES = [
  '',
  'ein',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf',
  'dreizehn',
  'vierzehn',
  'fünfzehn',
  'sechzehn',
  'siebzehn',
  'achtzehn',
  'neunzehn',
];
const TENS = [
  '',
  '',
  'zwanzig',
  'dreißig',
  'vierzig',
  'fünfzig',
  'sechzig',
  'siebzig',
  'achtzig',
  'neunzig',
];

/** 1–99; `last` means nothing follows, so 1 is „eins“ and not „ein“. */
function belowHundred(n: number, last: boolean): string {
  if (n === 1) return last ? 'eins' : 'ein';
  if (n < 20) return ONES[n] ?? '';
  const ones = n % 10;
  const tens = TENS[Math.floor(n / 10)] ?? '';
  return ones ? `${ONES[ones]}und${tens}` : tens;
}

function belowThousand(n: number, last: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return (hundreds ? `${ONES[hundreds]}hundert` : '') + (rest ? belowHundred(rest, last) : '');
}

export const MAX_WORDS_AMOUNT = 999_999_999;

/**
 * A whole number in German words, as written on contracts and cheques:
 * 12500 → „zwölftausendfünfhundert“, 1001 → „eintausendeins“.
 */
export function numberInWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_WORDS_AMOUNT)
    throw new RangeError(`Cannot write ${n} in words`);
  if (n === 0) return 'null';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor(n / 1000) % 1000;
  const rest = n % 1000;
  const below =
    (thousands ? `${belowThousand(thousands, false)}tausend` : '') +
    (rest ? belowThousand(rest, true) : '');
  if (!millions) return below;
  // „Million“ is feminine: 101 million is „einhunderteine Millionen“.
  const million =
    millions === 1
      ? 'eine Million'
      : `${belowThousand(millions, false).replace(/ein$/, 'eine')} Millionen`;
  return below ? `${million} ${below}` : million;
}
