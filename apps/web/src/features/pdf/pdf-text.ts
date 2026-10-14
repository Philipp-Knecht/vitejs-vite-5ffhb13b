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
  [String.fromCodePoint(0x202f)]: String.fromCodePoint(0xa0), // narrow no-break space
  '：': ':',
};

const PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;

/** Emoji, flags, skin tones, variation selectors and joiners are dropped instead of becoming „?“. */
function isEmojiPart(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    PICTOGRAPHIC.test(char) ||
    (code >= 0x1f1e6 && code <= 0x1f1ff) || // regional indicators (flags)
    (code >= 0x1f3fb && code <= 0x1f3ff) || // skin tones
    code === 0xfe0e ||
    code === 0xfe0f ||
    code === 0x200b ||
    code === 0x200d ||
    code === 0x20e3
  );
}

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
    else if (char in REPLACEMENTS) out += REPLACEMENTS[char];
    else if (isEmojiPart(char)) continue;
    else out += /\s/.test(char) ? ' ' : '?';
  }
  // Dropped emoji leave double, leading or trailing spaces behind.
  return out.replace(/ {2,}/g, ' ').replace(/^ +| +$/gm, '');
}
