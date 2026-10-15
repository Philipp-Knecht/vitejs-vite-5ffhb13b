import {
  CAR_LOG_KIND_LABELS,
  SERVICE_LOG_KINDS,
  type CarLogEntryDto,
  type OwnedCarDto,
} from '@kaufcheck/shared';
import { jsPDF } from 'jspdf';
import { toContractText, type ContractFonts } from '../sale-contract/contract-pdf';

const FONT = 'LiberationSans';
const PAGE = { width: 210, height: 297, margin: 16, footer: 10 } as const;
const SIZE = 9;
const LINE = SIZE * 0.42;
/** Date, km, kind, work, workshop, invoice – widths in mm. */
const COLUMNS = [
  { title: 'Datum', width: 20 },
  { title: 'km', width: 18 },
  { title: 'Art', width: 26 },
  { title: 'Arbeiten', width: 66 },
  { title: 'Werkstatt', width: 38 },
  { title: 'Beleg', width: 10 },
] as const;

const germanDate = (date: string) => date.split('-').reverse().join('.');

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
  text('Serviceheft', PAGE.margin, y);
  y += 9;
  font(SIZE + 1);
  const registration = car.firstRegistration.month
    ? `${String(car.firstRegistration.month).padStart(2, '0')}/${car.firstRegistration.year}`
    : String(car.firstRegistration.year);
  text(`${car.title}, Erstzulassung ${registration}`, PAGE.margin, y);
  y += 6;
  font(SIZE);
  doc.setTextColor(90);
  for (const line of doc.splitTextToSize(
    toContractText(
      `Vom Halter selbst geführt und am ${germanDate(createdAt.toISOString().slice(0, 10))} mit KaufCheck erstellt. KaufCheck und die Werkstätten haben die Einträge nicht bestätigt; maßgeblich sind Rechnungen und das Serviceheft des Herstellers.`,
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
    for (const column of COLUMNS) {
      text(column.title, x, y);
      x += column.width;
    }
    y += LINE + 1;
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
    const height = Math.max(1, ...cells.map((lines) => lines.length)) * LINE + 2;
    if (y + height > bottom) {
      doc.addPage();
      y = PAGE.margin;
      header();
    }
    let x = PAGE.margin;
    cells.forEach((lines, index) => {
      lines.forEach((line, row) => doc.text(line, x, y + row * LINE, { baseline: 'top' }));
      x += COLUMNS[index]!.width;
    });
    y += height;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    font(8);
    doc.setTextColor(90);
    doc.text(`Seite ${page} von ${pages}`, PAGE.width - PAGE.margin, PAGE.height - PAGE.margin, {
      align: 'right',
    });
  }
  return doc;
}
