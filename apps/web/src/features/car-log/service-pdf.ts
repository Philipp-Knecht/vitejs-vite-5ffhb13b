import {
  CAR_LOG_KIND_LABELS,
  SERVICE_LOG_KINDS,
  type CarLogEntryDto,
  type OwnedCarDto,
} from '@kaufcheck/shared';
import { jsPDF } from 'jspdf';
import { toContractText, type ContractFonts } from '../sale-contract/contract-pdf';
import { localDay } from './entry-form';

const FONT = 'LiberationSans';
const PAGE = { width: 210, height: 297, margin: 16, footer: 10 } as const;
const SIZE = 9;
const LINE = SIZE * 0.42;
/** Date, km, kind, work, workshop, invoice – widths in mm. */
const COLUMNS = [
  { title: 'Datum', width: 19 },
  { title: 'km', width: 16 },
  { title: 'Art', width: 25 },
  { title: 'Arbeiten', width: 62 },
  { title: 'Werkstatt', width: 37 },
  { title: 'Rechnung lt. Besitzer', width: 19 },
] as const;

const germanDate = (date: string) => date.split('-').reverse().join('.');
/** A row up to this many lines stays on one page; a longer one continues on the next. */
const KEEP_TOGETHER_LINES = 12;
const FOOTER = 'Selbst geführt – nicht von Werkstätten oder KaufCheck bestätigt';

export interface ServiceHistoryCar extends Pick<OwnedCarDto, 'firstRegistration'> {
  title: string;
}

/**
 * The self-kept service history as a PDF, e.g. for a buyer: service entries
 * only, without prices. Built in the browser like the purchase contract.
 */
export function buildServiceHistoryPdf(
  car: ServiceHistoryCar,
  entries: readonly CarLogEntryDto[],
  fonts: ContractFonts,
  createdAt: Date,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS(`${FONT}-Regular.ttf`, fonts.regular);
  doc.addFont(`${FONT}-Regular.ttf`, FONT, 'normal');
  doc.addFileToVFS(`${FONT}-Bold.ttf`, fonts.bold);
  doc.addFont(`${FONT}-Bold.ttf`, FONT, 'bold');
  const font = (size: number, bold = false) => {
    doc.setFont(FONT, bold ? 'bold' : 'normal');
    doc.setFontSize(size);
  };
  const text = (value: string, x: number, y: number) =>
    doc.text(toContractText(value), x, y, { baseline: 'top' });
  const bottom = PAGE.height - PAGE.margin - PAGE.footer;
  let y = PAGE.margin;

  font(16, true);
  text('Selbst geführtes Serviceheft', PAGE.margin, y);
  y += 9;
  font(SIZE + 1);
  const registration = car.firstRegistration.month
    ? `${String(car.firstRegistration.month).padStart(2, '0')}/${car.firstRegistration.year}`
    : String(car.firstRegistration.year);
  for (const line of doc.splitTextToSize(
    toContractText(`${car.title}, Erstzulassung ${registration}`),
    PAGE.width - 2 * PAGE.margin,
  ) as string[]) {
    doc.text(line, PAGE.margin, y, { baseline: 'top' });
    y += (SIZE + 1) * 0.42;
  }
  y += 2;
  font(SIZE);
  doc.setTextColor(90);
  for (const line of doc.splitTextToSize(
    toContractText(
      `Diese Übersicht hat der Besitzer selbst geführt und am ${germanDate(localDay(createdAt))} mit KaufCheck erstellt. Weder KaufCheck noch die genannten Werkstätten haben die Einträge geprüft oder bestätigt. Als Nachweis dienen nur Rechnungen, Werkstattbelege und Einträge im Serviceheft des Herstellers.`,
    ),
    PAGE.width - 2 * PAGE.margin,
  ) as string[]) {
    doc.text(line, PAGE.margin, y, { baseline: 'top' });
    y += LINE;
  }
  doc.setTextColor(20);
  y += 4;

  const header = () => {
    font(SIZE, true);
    let x = PAGE.margin;
    let lines = 1;
    for (const column of COLUMNS) {
      const title = doc.splitTextToSize(toContractText(column.title), column.width - 2) as string[];
      title.forEach((line, row) => doc.text(line, x, y + row * LINE, { baseline: 'top' }));
      lines = Math.max(lines, title.length);
      x += column.width;
    }
    y += lines * LINE + 1;
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
    y += 1.5;
    font(SIZE);
  };
  header();

  const rows = entries
    .filter((entry) => SERVICE_LOG_KINDS.has(entry.kind))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length === 0)
    text('Noch keine Einträge zu Wartung, Reparaturen, Reifen oder HU.', PAGE.margin, y);
  for (const entry of rows) {
    const cells = [
      germanDate(entry.date),
      entry.odometerKm === null ? '' : entry.odometerKm.toLocaleString('de-DE'),
      CAR_LOG_KIND_LABELS[entry.kind],
      entry.note ?? '',
      entry.workshop ?? '',
      entry.invoice ? 'ja' : '',
    ].map(
      (value, index) =>
        doc.splitTextToSize(toContractText(value), COLUMNS[index]!.width - 2) as string[],
    );
    const rowLines = Math.max(1, ...cells.map((lines) => lines.length));
    // A short row moves to the next page as a whole; a long one is split across pages.
    if (y + Math.min(rowLines, KEEP_TOGETHER_LINES) * LINE + 2 > bottom) {
      doc.addPage();
      y = PAGE.margin;
      header();
    }
    for (let row = 0; row < rowLines; row++) {
      if (y + LINE > bottom) {
        doc.addPage();
        y = PAGE.margin;
        header();
        // A row continued on a new page names its date again.
        if (row > 0) doc.text(cells[0]![0] ?? '', PAGE.margin, y, { baseline: 'top' });
      }
      let x = PAGE.margin;
      cells.forEach((lines, index) => {
        if (lines[row] !== undefined) doc.text(lines[row]!, x, y, { baseline: 'top' });
        x += COLUMNS[index]!.width;
      });
      y += LINE;
    }
    y += 2;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    font(8);
    doc.setTextColor(90);
    doc.text(toContractText(FOOTER), PAGE.margin, PAGE.height - PAGE.margin);
    doc.text(`Seite ${page} von ${pages}`, PAGE.width - PAGE.margin, PAGE.height - PAGE.margin, {
      align: 'right',
    });
  }
  return doc;
}
