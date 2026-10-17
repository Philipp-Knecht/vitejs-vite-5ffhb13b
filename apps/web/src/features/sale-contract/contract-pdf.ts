import { saleContractBlocks, type ContractBlock, type SaleContractValues } from '@kaufcheck/shared';
import { jsPDF } from 'jspdf';
import { toPdfText } from '../pdf/pdf-text';

/**
 * The purchase contract as an A4 PDF to print twice and sign. Built in the
 * browser from the form; nothing is sent anywhere. Empty fields become lines
 * and unanswered questions empty boxes, to be filled in by hand.
 *
 * With the embedded Liberation Sans (fonts/, SIL OFL), names such as
 * „Łukasz Żółć“ or „Şükrü Ağaoğlu“ print correctly; the built-in Helvetica
 * only knows Windows-1252.
 */

/** The TrueType files as Base64, from ./fonts.ts. */
export interface ContractFonts {
  regular: string;
  bold: string;
}

const FONT = 'LiberationSans';
/** Latin with all extensions, general punctuation and the euro sign. */
const SUPPORTED =
  /[\n\u0020-\u007e\u00a0-\u024f\u0259\u1e00-\u1eff\u2010\u2012-\u2027\u2030-\u205e\u20ac\u2116\u2122\u2190-\u2193\u2212\u2248\u2260\u2264\u2265]/u;
/** Characters the font has no glyph for, with a printable equivalent. */
const REPLACEMENTS: Readonly<Record<string, string>> = { '\u2011': '-' };
const PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;

/** Emoji, flags, skin tones, variation selectors and joiners. */
function isEmojiPart(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    PICTOGRAPHIC.test(char) ||
    (code >= 0x1f1e6 && code <= 0x1f1ff) ||
    (code >= 0x1f3fb && code <= 0x1f3ff) ||
    code === 0x200d ||
    code === 0xfe0e ||
    code === 0xfe0f
  );
}

/** Text for the embedded font: unknown characters become „?“, emoji are dropped. */
export function toContractText(text: string): string {
  let out = '';
  for (const char of text.normalize('NFC')) {
    if (char in REPLACEMENTS) out += REPLACEMENTS[char];
    else if (SUPPORTED.test(char)) out += char;
    else if (isEmojiPart(char)) continue;
    else out += /\s/u.test(char) ? ' ' : '?';
  }
  return out.replace(/ {2,}/g, ' ');
}

const PAGE = { width: 210, height: 297, margin: 18, footer: 10 } as const;
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
const LINE = 0.42; // line height factor: mm per pt of font size
const COLORS = { text: 20, muted: 90, rule: 150 } as const;
const BODY = 9.5;
const LABEL_WIDTH = 62;
const BOX = 3.2;

class ContractWriter {
  readonly doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  private y: number = PAGE.margin;
  /** While measuring, nothing is drawn and no page is added. */
  private dry = false;
  private readonly family: string;
  private readonly convert: (text: string) => string;

  constructor(fonts: ContractFonts | null) {
    if (fonts) {
      this.doc.addFileToVFS(`${FONT}-Regular.ttf`, fonts.regular);
      this.doc.addFont(`${FONT}-Regular.ttf`, FONT, 'normal');
      this.doc.addFileToVFS(`${FONT}-Bold.ttf`, fonts.bold);
      this.doc.addFont(`${FONT}-Bold.ttf`, FONT, 'bold');
    }
    this.family = fonts ? FONT : 'helvetica';
    this.convert = fonts ? toContractText : toPdfText;
  }

  /** Height a block takes, from the current position. */
  measure(render: () => void): number {
    const { y, dry } = this;
    this.dry = true;
    try {
      render();
      return this.y - y;
    } finally {
      this.y = y;
      this.dry = dry;
    }
  }

  /** Starts a new page unless `height` fits; for blocks that belong together. */
  keep(height: number) {
    // A block taller than a page breaks wherever it has to.
    if (height <= this.bottom() - PAGE.margin) this.ensure(height);
  }

  private text(text: string, x: number, y: number, options: { align?: 'center' | 'right' } = {}) {
    if (!this.dry) this.doc.text(this.convert(text), x, y, { baseline: 'top', ...options });
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: number, width: number) {
    if (this.dry) return;
    this.doc.setDrawColor(color);
    this.doc.setLineWidth(width);
    this.doc.line(x1, y1, x2, y2);
  }

  private width(text: string, size: number): number {
    this.font(size);
    return this.doc.getTextWidth(this.convert(text));
  }

  private lineHeight(size: number) {
    return size * LINE;
  }

  private bottom() {
    return PAGE.height - PAGE.margin - PAGE.footer;
  }

  private ensure(height: number) {
    if (!this.dry && this.y + height > this.bottom()) this.newPage();
  }

  newPage() {
    if (this.dry) return;
    this.doc.addPage();
    this.y = PAGE.margin;
  }

  private font(size: number, bold = false, muted = false) {
    this.doc.setFont(this.family, bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(muted ? COLORS.muted : COLORS.text);
  }

  private split(text: string, size: number, width: number, bold = false): string[] {
    this.font(size, bold);
    return this.doc.splitTextToSize(this.convert(text), width) as string[];
  }

  /** Writes wrapped text at x; returns nothing, moves y below it. */
  private write(lines: string[], x: number, size: number, bold = false, muted = false) {
    const height = this.lineHeight(size);
    for (const line of lines) {
      this.ensure(height);
      this.font(size, bold, muted);
      // Lines from split() are converted already.
      if (!this.dry) this.doc.text(line, x, this.y, { baseline: 'top' });
      this.y += height;
    }
  }

  /** A line to write on, from x to the right margin. */
  private rule(x: number, y: number) {
    this.line(x, y, PAGE.width - PAGE.margin, y, COLORS.rule, 0.2);
  }

  private box(x: number, y: number, checked: boolean) {
    if (this.dry) return;
    this.doc.setDrawColor(COLORS.text);
    this.doc.setLineWidth(0.25);
    this.doc.rect(x, y, BOX, BOX);
    if (checked) {
      this.doc.line(x + 0.6, y + 0.6, x + BOX - 0.6, y + BOX - 0.6);
      this.doc.line(x + BOX - 0.6, y + 0.6, x + 0.6, y + BOX - 0.6);
    }
  }

  title(text: string, subtitle: string) {
    this.font(16, true);
    this.text(text, PAGE.width / 2, this.y, { align: 'center' });
    this.y += this.lineHeight(16) + 1;
    this.font(11, false, true);
    this.text(subtitle, PAGE.width / 2, this.y, { align: 'center' });
    this.y += this.lineHeight(11) + 4;
  }

  heading(text: string) {
    this.y += 3;
    this.write(this.split(text, 11, CONTENT_WIDTH, true), PAGE.margin, 11, true);
    this.y += 1.5;
  }

  paragraph(text: string) {
    this.write(this.split(text, BODY, CONTENT_WIDTH), PAGE.margin, BODY);
    this.y += 1.8;
  }

  fields(title: string | undefined, rows: { label: string; value: string }[]) {
    if (title) {
      this.ensure(12);
      this.write(this.split(title, 10, CONTENT_WIDTH, true), PAGE.margin, 10, true);
      this.y += 0.8;
    }
    const valueX = PAGE.margin + LABEL_WIDTH;
    for (const row of rows) {
      const labels = this.split(row.label, 8.5, LABEL_WIDTH - 3);
      const values = row.value ? this.split(row.value, BODY, CONTENT_WIDTH - LABEL_WIDTH) : [];
      const labelHeight = labels.length * this.lineHeight(8.5);
      // An empty value gets room to write by hand; the label sits on the line.
      const blank = values.length === 0;
      const height = blank
        ? Math.max(7, labelHeight + 3)
        : Math.max(labelHeight, values.length * this.lineHeight(BODY));
      this.ensure(height + 1.2);
      const top = this.y;
      const lineY = top + height - 0.8;
      this.y = blank ? lineY - labelHeight : top;
      this.write(labels, PAGE.margin, 8.5, false, true);
      this.y = top;
      if (blank) this.rule(valueX, lineY);
      else this.write(values, valueX, BODY);
      this.y = top + height + 1.2;
    }
    this.y += 1;
  }

  /** Seller and buyer in two columns next to the labels. */
  parties(rows: { label: string; seller: string; buyer: string }[]) {
    const labelWidth = 40;
    const gap = 6;
    const column = (CONTENT_WIDTH - labelWidth - gap) / 2;
    const xs = [PAGE.margin + labelWidth, PAGE.margin + labelWidth + column + gap];
    this.ensure(12);
    this.font(10, true);
    this.text('Verkäufer', xs[0]!, this.y);
    this.text('Käufer', xs[1]!, this.y);
    this.y += this.lineHeight(10) + 1;
    for (const row of rows) {
      const labels = this.split(row.label, 8.5, labelWidth - 3);
      const cells = [row.seller, row.buyer].map((value) =>
        value ? this.split(value, BODY, column) : [],
      );
      const labelHeight = labels.length * this.lineHeight(8.5);
      const height = Math.max(
        7,
        labelHeight + 3,
        ...cells.map((lines) => lines.length * this.lineHeight(BODY) + 3),
      );
      this.ensure(height + 1);
      const top = this.y;
      const lineY = top + height - 0.8;
      this.y = lineY - labelHeight;
      this.write(labels, PAGE.margin, 8.5, false, true);
      cells.forEach((lines, index) => {
        const x = xs[index]!;
        if (lines.length) {
          this.y = lineY - lines.length * this.lineHeight(BODY) - 0.6;
          this.write(lines, x, BODY);
        }
        this.line(x, lineY, x + column, lineY, COLORS.rule, 0.2);
      });
      this.y = top + height + 1;
    }
    this.y += 1.5;
  }

  choice(block: Extract<ContractBlock, { kind: 'choice' }>) {
    const text = this.split(block.text, BODY, CONTENT_WIDTH);
    const optionX = PAGE.margin + 2;
    const labelGap = BOX + 2;
    const widths = block.options.map((option) => labelGap + this.width(option, BODY) + 6);
    // Short answers (Ja / Nein / Nicht bekannt) go on one line.
    const inline = widths.reduce((sum, width) => sum + width, 0) <= CONTENT_WIDTH - 2;
    const options = block.options.map((option) =>
      this.split(option, BODY, CONTENT_WIDTH - 2 - labelGap),
    );
    // The question and its first answer stay together (whole choices: see keep()).
    this.ensure((text.length + (options[0]?.length ?? 1)) * this.lineHeight(BODY) + 3);
    this.write(text, PAGE.margin, BODY);
    this.y += 0.8;
    if (inline) {
      let x = optionX;
      block.options.forEach((option, index) => {
        this.box(x, this.y + 0.1, block.checked === index);
        this.font(BODY);
        this.text(option, x + labelGap, this.y);
        x += widths[index] ?? 0;
      });
      this.y += this.lineHeight(BODY) + 0.8;
    } else {
      options.forEach((lines, index) => {
        this.ensure(lines.length * this.lineHeight(BODY) + 1);
        this.box(optionX, this.y + 0.1, block.checked === index);
        this.write(lines, optionX + labelGap, BODY);
        this.y += 0.8;
      });
    }
    const detail = block.detail;
    // A detail belongs to one answer: printed while that answer or none is ticked.
    if (detail && (block.checked === null || block.checked === detail.option)) {
      const label = `${detail.label}:`;
      if (detail.value) {
        this.write(this.split(`${label} ${detail.value}`, BODY, CONTENT_WIDTH - 2), optionX, BODY);
      } else {
        this.ensure(7);
        const labelWidth = this.width(label, 8.5);
        this.font(8.5, false, true);
        this.text(label, optionX, this.y + 2.6);
        this.rule(optionX + labelWidth + 2, this.y + 6);
        this.y += 7;
      }
    }
    this.y += 2;
  }

  checklist(items: { text: string; checked: boolean }[]) {
    for (const item of items) {
      const lines = this.split(item.text, BODY, CONTENT_WIDTH - BOX - 5);
      this.ensure(lines.length * this.lineHeight(BODY) + 1);
      this.box(PAGE.margin, this.y + 0.1, item.checked);
      this.write(lines, PAGE.margin + BOX + 3, BODY);
      this.y += 1;
    }
    this.y += 1.5;
  }

  lines(label: string | undefined, value: string, count: number) {
    this.ensure(5 + (value ? this.lineHeight(BODY) : count * 7));
    if (label) this.write(this.split(label, 8.5, CONTENT_WIDTH), PAGE.margin, 8.5, false, true);
    if (value) {
      this.write(this.split(value, BODY, CONTENT_WIDTH), PAGE.margin, BODY);
      this.y += 2;
      return;
    }
    for (let line = 0; line < count; line++) {
      this.y += 7;
      this.rule(PAGE.margin, this.y);
    }
    this.y += 3;
  }

  signatures(text: string, left: string, right: string) {
    const lines = this.split(text, BODY, CONTENT_WIDTH);
    // The closing sentence and the signatures stay on one page.
    this.ensure(lines.length * this.lineHeight(BODY) + 38);
    this.write(lines, PAGE.margin, BODY);
    this.y += 4;
    const half = (CONTENT_WIDTH - 10) / 2;
    const columns = [
      { x: PAGE.margin, role: left },
      { x: PAGE.margin + half + 10, role: right },
    ];
    for (const label of ['Ort, Datum', 'Unterschrift']) {
      this.y += 11;
      for (const { x, role } of columns) {
        this.line(x, this.y, x + half, this.y, COLORS.text, 0.25);
        this.font(8, false, true);
        this.text(label === 'Unterschrift' ? `Unterschrift ${role}` : label, x, this.y + 1.2);
      }
      this.y += 4;
    }
    this.y += 2;
  }

  footer(text: string, vin: string) {
    const pages = this.doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      this.doc.setPage(page);
      this.font(7.5, false, true);
      const y = PAGE.height - PAGE.margin + 2;
      this.text(text, PAGE.margin, y);
      this.text(`Seite ${page} von ${pages}`, PAGE.width - PAGE.margin, y, { align: 'right' });
      // Initials (and the FIN) on every page, so that no page can be swapped unnoticed.
      this.text(`${vin ? `FIN ${vin} · ` : ''}Kürzel: ________  ________`, PAGE.width / 2 + 14, y, {
        align: 'center',
      });
    }
  }
}

function render(w: ContractWriter, block: ContractBlock) {
  switch (block.kind) {
    case 'title':
      return w.title(block.text, block.subtitle);
    case 'heading':
      return w.heading(block.text);
    case 'paragraph':
      return w.paragraph(block.text);
    case 'fields':
      return w.fields(block.title, block.rows);
    case 'parties':
      return w.parties(block.rows);
    case 'choice':
      return w.choice(block);
    case 'checklist':
      return w.checklist(block.items);
    case 'lines':
      return w.lines(block.label, block.value, block.lines);
    case 'signatures':
      return w.signatures(block.text, block.left, block.right);
    case 'pageBreak':
      return w.newPage();
  }
}

/** What a block keeps on its page: a heading its section start (or all of it), others themselves. */
function keptWith(blocks: ContractBlock[], index: number): ContractBlock[] {
  const block = blocks[index]!;
  const next = blocks[index + 1];
  // A lead-in („… die angekreuzten Unterlagen:“) or a sentence with its receipt line.
  if (
    block.kind === 'paragraph' &&
    next &&
    (block.text.endsWith(':') || next.kind === 'fields' || next.kind === 'checklist')
  )
    return [block, next];
  if (block.kind !== 'heading') return [block];
  const rest = blocks.slice(index + 1);
  const end = rest.findIndex((next) => next.kind === 'heading' || next.kind === 'pageBreak');
  const section = end === -1 ? rest : rest.slice(0, end);
  return [block, ...(block.keepTogether ? section : section.slice(0, 1))];
}

export function buildSaleContractPdf(
  values: SaleContractValues,
  fonts: ContractFonts | null,
): jsPDF {
  const w = new ContractWriter(fonts);
  const blocks = saleContractBlocks(values);
  blocks.forEach((block, index) => {
    if (block.kind !== 'pageBreak') {
      w.keep(w.measure(() => keptWith(blocks, index).forEach((item) => render(w, item))));
    }
    render(w, block);
  });
  w.footer(
    'Vertragsmuster von KaufCheck, keine Rechtsberatung',
    values.vin.replace(/\s/g, '').toUpperCase(),
  );
  return w.doc;
}

export function saleContractFileName(values: SaleContractValues, createdAt: Date): string {
  const slug = `${values.make} ${values.model}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${createdAt.getFullYear()}-${pad(createdAt.getMonth() + 1)}-${pad(createdAt.getDate())}`;
  return `kaufvertrag${slug ? `-${slug}` : ''}-${day}.pdf`;
}
