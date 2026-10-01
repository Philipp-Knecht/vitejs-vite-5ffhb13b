import { operatorLine, paragraph, type LegalContext, type LegalDocument } from './document';

export const CANCEL_PATH = '/vertrag-kuendigen';
export const WITHDRAW_PATH = '/vertrag-widerrufen';
export const TERMS_PATH = '/agb';
export const WITHDRAWAL_POLICY_PATH = '/widerrufsbelehrung';

/** Days the consumer has to withdraw from the contract (§ 355 Abs. 2 BGB). */
export const WITHDRAWAL_PERIOD_DAYS = 14;

/**
 * The official model withdrawal notice (Anlage 1 zu Art. 246a § 1 Abs. 2
 * Satz 2 EGBGB) for a service contract, filled in as the notes on its use
 * require: period from the conclusion of the contract, the operator's name,
 * address, phone and e-mail, the online withdrawal function (§ 356a BGB) and
 * the compensation for services started on request. The wording must stay
 * exactly as published – including "Sie" and the delivery-cost sentence.
 */
export function withdrawalPolicy({ operator, siteUrl }: LegalContext): LegalDocument {
  return {
    title: 'Widerrufsbelehrung',
    sections: [
      {
        heading: 'Widerrufsrecht',
        blocks: [
          paragraph(
            'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
          ),
          paragraph('Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.'),
          paragraph(
            `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${operatorLine(operator)}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Sie können Ihr Widerrufsrecht auch online unter ${siteUrl}${WITHDRAW_PATH} (Schaltfläche „Vertrag widerrufen“ am Ende jeder Seite) ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.`,
          ),
          paragraph(
            'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
          ),
        ],
      },
      {
        heading: 'Folgen des Widerrufs',
        blocks: [
          paragraph(
            'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
          ),
          paragraph(
            'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.',
          ),
        ],
      },
      { blocks: [paragraph('Ende der Widerrufsbelehrung')] },
    ],
  };
}

/** The official model withdrawal form (Anlage 2 zu Art. 246a § 1 Abs. 2 Satz 1 Nr. 1 EGBGB). */
export function withdrawalForm({ operator }: LegalContext): LegalDocument {
  return {
    title: 'Muster-Widerrufsformular',
    sections: [
      {
        blocks: [
          paragraph(
            '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
          ),
          {
            kind: 'list',
            items: [
              `An ${operatorLine(operator, { phone: false })}:`,
              'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)',
              'Bestellt am (*)/erhalten am (*)',
              'Name des/der Verbraucher(s)',
              'Anschrift des/der Verbraucher(s)',
              'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)',
              'Datum',
            ],
          },
          paragraph('(*) Unzutreffendes streichen.'),
        ],
      },
    ],
  };
}
