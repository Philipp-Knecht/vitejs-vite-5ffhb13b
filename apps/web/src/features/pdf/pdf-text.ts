/**
 * The PDF uses the standard Helvetica font (no embedded font file), which only
 * knows the Windows-1252 character set. Everything else is replaced by a
 * readable equivalent so that no character turns into garbage.
 */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

const REPLACEMENTS: Readonly<Record<string, string>> = {
  '→': '->',
  '←': '<-',
  '≤': '<=',
  '≥': '>=',
  '≈': '~',
  '−': '-',
  '‑': '-',
  ' ': ' ',
  ' ': ' ',
  '​': '',
  '：': ':',
  '✓': 'x',
  '✔': 'x',
};

function isWinAnsi(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    char === '\n' ||
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRA.has(char)
  );
}

export function toPdfText(text: string): string {
  let out = '';
  for (const char of text.normalize('NFC')) {
    if (isWinAnsi(char)) out += char;
    else out += REPLACEMENTS[char] ?? (/\s/.test(char) ? ' ' : '?');
  }
  return out;
}
