/**
 * Legal texts as plain structured data, so the web pages and the e-mails
 * that confirm a contract show exactly the same wording.
 */
export type LegalBlock =
  { kind: 'paragraph'; text: string } | { kind: 'list'; items: readonly string[] };

export interface LegalSection {
  heading?: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  title: string;
  /** Shown under the title, e.g. the version date. */
  subtitle?: string;
  sections: readonly LegalSection[];
}

/** Operator details named in contracts and legal texts (from the imprint settings). */
export interface OperatorInfo {
  name: string;
  addressLines: readonly string[];
  email: string;
  /** Required for paid contracts (Art. 246a § 1 Abs. 1 Nr. 3 EGBGB). */
  phone: string;
}

export interface LegalContext {
  operator: OperatorInfo;
  /** Public address of the site without a trailing slash. */
  siteUrl: string;
}

export const paragraph = (text: string): LegalBlock => ({ kind: 'paragraph', text });
export const list = (items: readonly string[]): LegalBlock => ({ kind: 'list', items });

/** Name, address, phone and e-mail in one line. */
export function operatorLine(operator: OperatorInfo, options: { phone?: boolean } = {}): string {
  const parts = [operator.name, ...operator.addressLines];
  if (options.phone !== false && operator.phone) parts.push(`Telefon: ${operator.phone}`);
  parts.push(`E-Mail: ${operator.email}`);
  return parts.join(', ');
}

/** Plain-text rendering for e-mails (a durable medium for the contract documents). */
export function documentToText(document: LegalDocument): string {
  const lines: string[] = [document.title.toUpperCase()];
  if (document.subtitle) lines.push(document.subtitle);
  for (const section of document.sections) {
    lines.push('');
    if (section.heading) lines.push(section.heading, '');
    section.blocks.forEach((block, index) => {
      if (index > 0) lines.push('');
      if (block.kind === 'paragraph') lines.push(block.text);
      else lines.push(...block.items.map((item) => `– ${item}`));
    });
  }
  return lines.join('\n');
}
