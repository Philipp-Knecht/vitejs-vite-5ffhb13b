import type { LegalDocument } from '@kaufcheck/shared';
import { Download, Printer } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { downloadTextFile } from '../../lib/download';
import { linkify } from './legal-text';

/** Renders a legal document (AGB, Widerrufsbelehrung) with the exact shared wording. */
export function LegalDocumentView({
  document,
  level = 1,
}: {
  document: LegalDocument;
  /** 1 = page title, 2 = a further document on the same page. */
  level?: 1 | 2;
}) {
  const Title = level === 1 ? 'h1' : 'h2';
  const Heading = level === 1 ? 'h2' : 'h3';
  return (
    <section className="legal-document">
      <Title>{document.title}</Title>
      {document.subtitle && <p className="page__lead">{document.subtitle}</p>}
      {document.sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="legal-document__section">
          {section.heading && <Heading>{section.heading}</Heading>}
          {section.blocks.map((block, blockIndex) =>
            block.kind === 'paragraph' ? (
              <p key={blockIndex}>{linkify(block.text)}</p>
            ) : (
              <ul key={blockIndex}>
                {block.items.map((item) => (
                  <li key={item}>{linkify(item)}</li>
                ))}
              </ul>
            ),
          )}
        </div>
      ))}
    </section>
  );
}

/** Lets the visitor keep a copy: as a text file or printed / saved as PDF by the browser. */
export function SaveButtons({ fileName, text }: { fileName: string; text: () => string }) {
  return (
    <div className="button-row save-buttons">
      <Button
        variant="secondary"
        icon={<Download aria-hidden size={18} />}
        onClick={() => downloadTextFile(fileName, text())}
      >
        Als Textdatei speichern
      </Button>
      <Button
        variant="secondary"
        icon={<Printer aria-hidden size={18} />}
        onClick={() => window.print()}
      >
        Drucken oder als PDF speichern
      </Button>
    </div>
  );
}
