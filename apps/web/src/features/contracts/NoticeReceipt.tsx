import {
  noticeFields,
  noticeOutcomeText,
  noticeReceiptText,
  type ContractNoticeReceipt,
} from '@kaufcheck/shared';
import { useEffect, useRef } from 'react';
import { Alert } from '../../components/ui/Alert';
import { SaveButtons } from '../../pages/legal/LegalDocument';
import { IMPRINT, SITE_URL } from '../../pages/legal/site-info';

/**
 * The declaration as received, with date and time – to keep as a file or a
 * print-out (§ 312k Abs. 3 BGB); the same content goes out by e-mail.
 */
export function NoticeReceipt({ receipt }: { receipt: ContractNoticeReceipt }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const cancellation = receipt.type === 'cancellation';
  useEffect(() => heading.current?.focus(), []);

  return (
    <section className="notice-receipt" aria-labelledby="notice-receipt-title">
      <h2 id="notice-receipt-title" ref={heading} tabIndex={-1}>
        {cancellation ? 'Deine Kündigung ist eingegangen' : 'Dein Widerruf ist eingegangen'}
      </h2>
      <Alert tone={receipt.outcome === 'review' ? 'info' : 'success'}>
        <p>{noticeOutcomeText(receipt)}</p>
      </Alert>
      {receipt.confirmationSent ? (
        <p>
          Eine Bestätigung mit diesen Angaben haben wir an <strong>{receipt.email}</strong>{' '}
          geschickt.
        </p>
      ) : (
        <Alert tone="warning" title="Keine Bestätigung per E-Mail">
          <p>
            Die Bestätigung per E-Mail konnten wir nicht senden. Bitte speichere diese Bestätigung
            als Nachweis.
            {IMPRINT.email && (
              <>
                {' '}
                Bei Fragen erreichst du uns unter{' '}
                <a href={`mailto:${IMPRINT.email}`}>{IMPRINT.email}</a>.
              </>
            )}
          </p>
        </Alert>
      )}
      <dl className="definition-list notice-receipt__fields">
        {noticeFields(receipt).map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      <SaveButtons
        fileName={`kaufcheck-${cancellation ? 'kuendigung' : 'widerruf'}-${receipt.number}.txt`}
        text={() => noticeReceiptText(receipt, SITE_URL)}
      />
    </section>
  );
}
