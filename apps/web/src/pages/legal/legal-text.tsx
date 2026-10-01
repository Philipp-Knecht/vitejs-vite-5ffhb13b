import { documentToText, type LegalDocument } from '@kaufcheck/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SITE_URL } from './site-info';

// Web addresses (not ending in a punctuation mark) and e-mail addresses in legal texts.
const LINK_PATTERN = /(https?:\/\/[^\s)„“,]*[^\s)„“,.]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/** Turns web and e-mail addresses into links; addresses of this site become in-app links. */
export function linkify(text: string): ReactNode[] {
  return text.split(LINK_PATTERN).map((part, index) => {
    if (index % 2 === 0) return part;
    if (part.startsWith(`${SITE_URL}/`)) {
      return (
        <Link key={index} to={part.slice(SITE_URL.length)}>
          {part}
        </Link>
      );
    }
    const href = part.startsWith('http') ? part : `mailto:${part}`;
    return (
      <a key={index} href={href}>
        {part}
      </a>
    );
  });
}

export function documentsText(documents: readonly LegalDocument[]): string {
  return `${documents.map(documentToText).join('\n\n')}\n`;
}
