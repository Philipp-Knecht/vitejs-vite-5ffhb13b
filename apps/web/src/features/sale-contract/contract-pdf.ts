import { saleContractBlocks, type ContractBlock, type SaleContractValues } from '@kaufcheck/shared';
import { jsPDF } from 'jspdf';
import { toPdfText } from '../pdf/pdf-text';

/**
 * The purchase contract as an A4 PDF to print twice and sign. Built in the
 * browser from the form; nothing is sent anywhere. Empty fields become lines
 * and unanswered questions empty boxes, to be filled in by hand.
 */

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

  private lineHeight(size: number) {
    return size * LINE;
  }

  private bottom() {
    return PAGE.height - PAGE.margin - PAGE.footer;
  }

  private ensure(height: number) {
    if (this.y + height > this.bottom()) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.y = PAGE.margin;
  }

  private font(size: number, bold = false, muted = false) {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(muted ? COLORS.muted : COLORS.text);
  }

  private split(text: string, size: number, width: number, bold = false): string[] {
    this.font(size, bold);
    return this.doc.splitTextToSize(toPdfText(text), width) as string[];
  }

  /** Writes wrapped text at x; returns nothing, moves y below it. */
  private write(lines: string[], x: number, size: number, bold = false, muted = false) {
    const height = this.lineHeight(size);
    for (const line of lines) {
      this.ensure(height);
      this.font(size, bold, muted);
      this.doc.text(line, x, this.y, { baseline: 'top' });
      this.y += height;
    }
  }

  /** A line to write on, from x to the right margin. */
  private rule(x: number, y: number) {
    this.doc.setDrawColor(COLORS.rule);
    this.doc.setLineWidth(0.2);
    this.doc.line(x, y, PAGE.width - PAGE.margin, y);
  }

  private box(x: number, y: number, checked: boolean) {
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
    this.doc.text(toPdfText(text), PAGE.width / 2, this.y, { baseline: 'top', align: 'center' });
    this.y += this.lineHeight(16) + 1;
    this.font(11, false, true);
    this.doc.text(toPdfText(subtitle), PAGE.width / 2, this.y, {
      baseline: 'top',
      align: 'center',
    });
    this.y += this.lineHeight(11) + 4;
  }

  heading(text: string) {
    // A heading stays with the start of its section.
    this.ensure(22);
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
      this.write([toPdfText(title)], PAGE.margin, 10, true);
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
    this.doc.text('Verkäufer', xs[0]!, this.y, { baseline: 'top' });
    this.doc.text('Käufer', xs[1]!, this.y, { baseline: 'top' });
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
        this.doc.setDrawColor(COLORS.rule);
        this.doc.setLineWidth(0.2);
        this.doc.line(x, lineY, x + column, lineY);
      });
      this.y = top + height + 1;
    }
    this.y += 1.5;
  }

  choice(block: Extract<ContractBlock, { kind: 'choice' }>) {
    const text = this.split(block.text, BODY, CONTENT_WIDTH);
    const optionX = PAGE.margin + 2;
    const labelGap = BOX + 2;
    this.font(BODY);
    const widths = block.options.map(
      (option) => labelGap + this.doc.getTextWidth(toPdfText(option)) + 6,
    );
    // Short answers (Ja / Nein / Nicht bekannt) go on one line.
    const inline = widths.reduce((sum, width) => sum + width, 0) <= CONTENT_WIDTH - 2;
    const options = block.options.map((option) =>
      this.split(option, BODY, CONTENT_WIDTH - 2 - labelGap),
    );
    // The question and its first answer stay together.
    this.ensure((text.length + (options[0]?.length ?? 1)) * this.lineHeight(BODY) + 3);
    this.write(text, PAGE.margin, BODY);
    this.y += 0.8;
    if (inline) {
      let x = optionX;
      block.options.forEach((option, index) => {
        this.box(x, this.y + 0.1, block.checked === index);
        this.font(BODY);
        this.doc.text(toPdfText(option), x + labelGap, this.y, { baseline: 'top' });
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
        this.font(8.5, false, true);
        this.doc.text(toPdfText(label), optionX, this.y + 2.6, { baseline: 'top' });
        this.rule(optionX + this.doc.getTextWidth(toPdfText(label)) + 2, this.y + 6);
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
        this.doc.setDrawColor(COLORS.text);
        this.doc.setLineWidth(0.25);
        this.doc.line(x, this.y, x + half, this.y);
        this.font(8, false, true);
        const text = label === 'Unterschrift' ? `Unterschrift ${role}` : label;
        this.doc.text(toPdfText(text), x, this.y + 1.2, { baseline: 'top' });
      }
      this.y += 4;
    }
    this.y += 2;
  }

  footer(text: string) {
    const pages = this.doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      this.doc.setPage(page);
      this.font(7.5, false, true);
      const y = PAGE.height - PAGE.margin + 4;
      this.doc.text(toPdfText(text), PAGE.margin, y);
      this.doc.text(`Seite ${page} von ${pages}`, PAGE.width - PAGE.margin, y, { align: 'right' });
      // Initials on every page, so that no page can be swapped unnoticed.
      this.doc.text('Kürzel: ________  ________', PAGE.width / 2 + 18, y, { align: 'center' });
    }
  }
}

export function buildSaleContractPdf(values: SaleContractValues): jsPDF {
  const w = new ContractWriter();
  for (const block of saleContractBlocks(values)) {
    switch (block.kind) {
      case 'title':
        w.title(block.text, block.subtitle);
        break;
      case 'heading':
        w.heading(block.text);
        break;
      case 'paragraph':
        w.paragraph(block.text);
        break;
      case 'fields':
        w.fields(block.title, block.rows);
        break;
      case 'parties':
        w.parties(block.rows);
        break;
      case 'choice':
        w.choice(block);
        break;
      case 'checklist':
        w.checklist(block.items);
        break;
      case 'lines':
        w.lines(block.label, block.value, block.lines);
        break;
      case 'signatures':
        w.signatures(block.text, block.left, block.right);
        break;
      case 'pageBreak':
        w.newPage();
        break;
    }
  }
  w.footer('Vertragsmuster von KaufCheck, keine Rechtsberatung');
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
