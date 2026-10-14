import {
  KBA_RECALL_DATABASE_URL,
  findMake,
  recallCheckFor,
  type CarModel,
  type Generation,
} from '@kaufcheck/catalog';
import { EVIDENCE_LABELS, type AnalysisDto } from '@kaufcheck/shared';
import { jsPDF } from 'jspdf';
import { toPdfText } from './pdf-text';

/**
 * The "Besichtigungsmappe": one analysis as an A4 PDF to take to the viewing –
 * summary, findings, seller questions, recall check, known weaknesses of the
 * generation and the checklist with boxes. Built in the browser from the data
 * the result page already shows; nothing is sent anywhere.
 */
export interface AnalysisPdfInput {
  dto: AnalysisDto;
  /** Researched knowledge about the listed model, if KaufCheck has it. */
  model: CarModel | null;
  /** Seller questions in the formal ("Sie") or informal ("du") version. */
  formal: boolean;
  /** Checklist items ticked in this browser. */
  checked: ReadonlySet<string>;
  /** Origin of the site, for the links back to the analysis and the model page. */
  siteUrl: string;
  createdAt: Date;
}

const PAGE = { width: 210, height: 297, margin: 18, footer: 12 } as const;
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
const LINE = 0.42; // line height factor: mm per pt of font size
const COLORS = { text: 20, muted: 90, rule: 200 } as const;

type Style = { size?: number; bold?: boolean; muted?: boolean; indent?: number; gap?: number };

class Writer {
  readonly doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  private y = PAGE.margin;

  private lineHeight(size: number) {
    return size * LINE;
  }

  private ensure(height: number) {
    if (this.y + height > PAGE.height - PAGE.margin - PAGE.footer) {
      this.doc.addPage();
      this.y = PAGE.margin;
    }
  }

  private font(size: number, bold: boolean, muted: boolean) {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(muted ? COLORS.muted : COLORS.text);
  }

  private lines(text: string, size: number, bold: boolean, width: number): string[] {
    this.font(size, bold, false);
    return this.doc.splitTextToSize(toPdfText(text), width) as string[];
  }

  text(text: string, style: Style = {}) {
    const { size = 10, bold = false, muted = false, indent = 0, gap = 1.5 } = style;
    const lines = this.lines(text, size, bold, CONTENT_WIDTH - indent);
    const height = this.lineHeight(size);
    for (const line of lines) {
      this.ensure(height);
      this.font(size, bold, muted);
      this.doc.text(line, PAGE.margin + indent, this.y, { baseline: 'top' });
      this.y += height;
    }
    this.y += gap;
  }

  /** A text with its address written out, so that it also works on paper. */
  link(label: string, url: string, style: Style = {}) {
    this.text(`${label}: ${url}`, style);
  }

  heading(text: string) {
    this.ensure(18);
    this.y += 3;
    this.text(text, { size: 14, bold: true, gap: 1 });
    this.doc.setDrawColor(COLORS.rule);
    this.doc.line(PAGE.margin, this.y, PAGE.width - PAGE.margin, this.y);
    this.y += 3;
  }

  subheading(text: string) {
    this.ensure(10);
    this.text(text, { size: 11, bold: true, gap: 1 });
  }

  bullet(text: string, style: Style = {}) {
    const indent = style.indent ?? 0;
    const size = style.size ?? 10;
    this.ensure(this.lineHeight(size));
    this.font(size, false, style.muted ?? false);
    this.doc.text('•', PAGE.margin + indent, this.y, { baseline: 'top' });
    this.text(text, { ...style, indent: indent + 4 });
  }

  numbered(index: number, text: string) {
    this.ensure(this.lineHeight(10));
    this.font(10, false, false);
    this.doc.text(`${index}.`, PAGE.margin, this.y, { baseline: 'top' });
    this.text(text, { indent: 7 });
  }

  checkbox(label: string, hint: string | null, checked: boolean) {
    const size = 10;
    const box = 3.6;
    this.ensure(this.lineHeight(size) + (hint ? this.lineHeight(9) : 0) + 1);
    this.doc.setDrawColor(COLORS.text);
    this.doc.rect(PAGE.margin, this.y + 0.2, box, box);
    if (checked) {
      this.doc.line(PAGE.margin + 0.7, this.y + 2, PAGE.margin + 1.6, this.y + 3.1);
      this.doc.line(PAGE.margin + 1.6, this.y + 3.1, PAGE.margin + 3, this.y + 0.9);
    }
    this.text(label, { indent: 6, gap: hint ? 0.3 : 1.8 });
    if (hint) this.text(hint, { indent: 6, size: 9, muted: true, gap: 1.8 });
  }

  /** Empty lines for handwritten notes. */
  noteLines(count: number) {
    this.doc.setDrawColor(COLORS.rule);
    for (let i = 0; i < count; i++) {
      this.ensure(8);
      this.y += 8;
      this.doc.line(PAGE.margin, this.y, PAGE.width - PAGE.margin, this.y);
    }
    this.y += 3;
  }

  space(mm: number) {
    this.y += mm;
  }

  footer(text: string) {
    const pages = this.doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      this.doc.setPage(page);
      this.font(8, false, true);
      const y = PAGE.height - PAGE.margin + 4;
      this.doc.text(toPdfText(text), PAGE.margin, y);
      this.doc.text(`Seite ${page} von ${pages}`, PAGE.width - PAGE.margin, y, { align: 'right' });
    }
  }
}

const yearsLabel = ([from, to]: readonly [number, number | null]) =>
  to === null ? `seit ${from}` : `${from}–${to}`;

/** Generations built in the year of first registration (several around a model change). */
function generationsFor(model: CarModel, year: number | null): Generation[] {
  if (year === null) return [];
  return model.generations.filter(
    (generation) => generation.years[0] <= year && (generation.years[1] ?? year) >= year,
  );
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function buildAnalysisPdf(input: AnalysisPdfInput): jsPDF {
  const { dto, model, formal, checked, siteUrl, createdAt } = input;
  const { analysis, listing } = dto;
  const title = analysis.vehicleSummary?.title ?? listing.title ?? 'Auto-Inserat';
  const w = new Writer();
  w.doc.setProperties({
    title: `KaufCheck – ${toPdfText(title)}`,
    subject: 'Besichtigungsmappe',
    creator: 'KaufCheck',
  });

  // Title block
  w.text('KaufCheck · Besichtigungsmappe', { size: 9, muted: true, gap: 1 });
  w.text(title, { size: 18, bold: true, gap: 1 });
  const chips = analysis.vehicleSummary?.chips.map((chip) => chip.text) ?? [];
  if (chips.length > 0) w.text(chips.join(' · '), { size: 10, gap: 1 });
  if (listing.source.url) w.link('Inserat', listing.source.url, { size: 9, muted: true, gap: 0.5 });
  w.link('Prüfung', `${siteUrl}/analyse/${dto.id}`, { size: 9, muted: true, gap: 0.5 });
  w.text(`Erstellt am ${formatDay(createdAt)} · Regelwerk ${analysis.rulesVersion}`, {
    size: 9,
    muted: true,
    gap: 2,
  });
  w.text(analysis.disclaimer, { size: 9, muted: true, gap: 2 });

  // Summary
  w.heading('Das Wichtigste in Kürze');
  w.text(analysis.summary.text);
  if (analysis.summary.positives.length > 0) {
    w.subheading('Spricht dafür');
    for (const item of analysis.summary.positives) w.bullet(item.text);
  }
  if (analysis.summary.openPoints.length > 0) {
    w.subheading('Offen oder auffällig');
    for (const item of analysis.summary.openPoints) w.bullet(item.text);
  }

  // Overview
  w.heading('Überblick');
  for (const item of analysis.overview) {
    const value = item.value ?? 'nicht angegeben';
    const evidence = item.value === null ? '' : ` (${EVIDENCE_LABELS[item.evidence]})`;
    w.bullet(`${item.label}: ${value}${evidence}`);
  }

  // Findings and checks
  if (analysis.observations.length > 0 || analysis.checks.length > 0) {
    w.heading('Darauf solltest du achten');
    for (const observation of analysis.observations) {
      w.text(observation.title, { bold: true, gap: 0.5 });
      w.text(observation.detail, { gap: 2.5 });
    }
    for (const check of analysis.checks) {
      w.text(check.title, { bold: true, gap: 0.5 });
      w.text(check.detail, { gap: 2.5 });
    }
  }

  // Known weaknesses of the generation
  const year = listing.vehicle?.firstRegistration?.year ?? null;
  const generations = model ? generationsFor(model, year) : [];
  if (model) {
    w.heading(`${model.make} ${model.model}: bekannte Schwachstellen`);
    if (generations.length === 0) {
      w.text(
        'Ohne Erstzulassung lässt sich die Generation nicht zuordnen. Alle Generationen stehen auf der Modellseite.',
      );
    }
    for (const generation of generations) {
      w.subheading(`${generation.name} (${yearsLabel(generation.years)})`);
      if (generation.issues.length === 0) {
        w.text('Für diese Generation sind keine Schwachstellen mit Quelle erfasst.', {
          muted: true,
        });
      }
      for (const issue of generation.issues) {
        w.text(issue.title, { bold: true, gap: 0.3 });
        w.text(`Betrifft: ${issue.affects}`, { size: 9, muted: true, gap: 0.3 });
        w.text(`Darauf achten: ${issue.check}`, { gap: 0.3 });
        w.text(`Quelle: ${issue.sources.map((source) => source.label).join(', ')}`, {
          size: 8,
          muted: true,
          gap: 2.5,
        });
      }
      if (generation.tips.length > 0) {
        w.text('Tipps für die Besichtigung', { bold: true, gap: 0.5 });
        for (const tip of generation.tips) w.bullet(tip);
      }
    }
    w.text('Nicht jedes Auto ist betroffen; nur die Besichtigung zeigt den Zustand.', {
      size: 9,
      muted: true,
      gap: 0.5,
    });
    w.link('Alle Infos', `${siteUrl}/modelle/${model.id}`, { size: 9, muted: true });
  }

  // Seller questions
  if (analysis.sellerQuestions.length > 0) {
    w.heading('Fragen an den Verkäufer');
    analysis.sellerQuestions.forEach((question, index) =>
      w.numbered(index + 1, formal ? question.text : question.textInformal),
    );
  }

  // Recall check
  w.heading('Rückrufe prüfen');
  const make = findMake(listing.vehicle?.make);
  const recall = make ? recallCheckFor(make.id) : null;
  w.bullet(
    'FIN erfragen: Sie steht im Fahrzeugschein (Zulassungsbescheinigung Teil I, Feld E) und oft unten an der Windschutzscheibe.',
  );
  if (make && recall?.lookup === 'vin') {
    w.bullet(`FIN-Abfrage von ${make.name}: ${recall.url}`);
  }
  w.bullet(
    'In einer Vertragswerkstatt oder bei der Kundenhotline des Herstellers nach offenen Rückrufen zur FIN fragen.',
  );
  if (make && recall?.lookup === 'info') {
    w.bullet(`Rückrufseite von ${make.name} (ohne FIN-Abfrage): ${recall.url}`);
  }
  w.bullet(
    `Rückrufdatenbank des Kraftfahrt-Bundesamts (nach Hersteller, Modell und Baujahr): ${KBA_RECALL_DATABASE_URL}`,
  );
  w.bullet('Werkstattbelege zu erledigten Rückrufen zeigen lassen.');

  // Checklist
  w.heading('Checkliste für die Besichtigung');
  for (const section of analysis.inspectionChecklist) {
    w.subheading(section.title);
    for (const item of section.items) w.checkbox(item.label, item.hint, checked.has(item.id));
    w.space(1);
  }

  w.heading('Notizen');
  w.noteLines(8);

  w.footer('KaufCheck · keine Kaufempfehlung, Angaben ohne Gewähr');
  return w.doc;
}

/** File name like "kaufcheck-vw-golf-2026-10-14.pdf". */
export function analysisPdfFileName(title: string, createdAt: Date): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  const day = createdAt.toISOString().slice(0, 10);
  return `kaufcheck-${slug || 'pruefung'}-${day}.pdf`;
}
