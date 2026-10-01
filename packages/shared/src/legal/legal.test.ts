import { describe, expect, it } from 'vitest';
import { DEFAULT_ENTITLEMENTS } from '../plans';
import {
  contractTerms,
  documentToText,
  proFeatures,
  termsOfService,
  withdrawalDeadline,
  withdrawalForm,
  withdrawalPolicy,
  withinWithdrawalPeriod,
  type LegalContext,
} from './index';

const CONTEXT: LegalContext = {
  operator: {
    name: 'Erika Musterfrau',
    addressLines: ['Musterstraße 1', '12345 Musterstadt'],
    email: 'kontakt@kaufcheck.example',
    phone: '+49 30 1234567',
  },
  siteUrl: 'https://kaufcheck.example',
};

describe('withdrawal period', () => {
  it('ends fourteen days after the day of the contract, in German time', () => {
    // Thursday, 1 October 2026 → Thursday, 15 October.
    expect(withdrawalDeadline(new Date('2026-10-01T10:00:00Z'))).toBe('2026-10-15');
    // 00:30 on 2 October in Berlin counts as 2 October.
    expect(withdrawalDeadline(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-16');
  });

  it('moves to Monday when the last day is a weekend day', () => {
    // Saturday, 3 October → Saturday, 17 October → Monday, 19 October.
    expect(withdrawalDeadline(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-19');
    // Sunday, 4 October → Sunday, 18 October → Monday, 19 October.
    expect(withdrawalDeadline(new Date('2026-10-04T10:00:00Z'))).toBe('2026-10-19');
  });

  it('includes the whole last day', () => {
    const concluded = new Date('2026-10-01T10:00:00Z');
    expect(withinWithdrawalPeriod(concluded, new Date('2026-10-15T21:59:00Z'))).toBe(true);
    expect(withinWithdrawalPeriod(concluded, new Date('2026-10-15T22:01:00Z'))).toBe(false);
  });
});

describe('withdrawal notice', () => {
  it('follows the official model for a service with the online function', () => {
    const text = documentToText(withdrawalPolicy(CONTEXT));
    for (const sentence of [
      'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
      'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
      'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Erika Musterfrau, Musterstraße 1, 12345 Musterstadt, Telefon: +49 30 1234567, E-Mail: kontakt@kaufcheck.example) mittels einer eindeutigen Erklärung',
      'Sie können Ihr Widerrufsrecht auch online unter https://kaufcheck.example/vertrag-widerrufen',
      'Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung',
      'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen',
    ]) {
      expect(text).toContain(sentence);
    }
  });

  it('includes the model form without the phone number', () => {
    const text = documentToText(withdrawalForm(CONTEXT));
    expect(text).toContain(
      '– An Erika Musterfrau, Musterstraße 1, 12345 Musterstadt, E-Mail: kontakt@kaufcheck.example:',
    );
    expect(text).not.toContain('Telefon');
    expect(text).toContain('(*) Unzutreffendes streichen.');
  });
});

describe('terms of service', () => {
  it('names the operator, the order button, cancellation and the dispute statement', () => {
    const text = documentToText(termsOfService(CONTEXT));
    expect(text).toContain('Stand: 1. Oktober 2026');
    expect(text).toContain('Telefon: +49 30 1234567');
    expect(text).toContain('„Zahlungspflichtig bestellen“');
    expect(text).toContain('„Verträge hier kündigen“');
    expect(text).toContain('https://kaufcheck.example/vertrag-kuendigen');
    expect(text).toContain('Verbraucherschlichtungsstelle');
    expect(text).not.toMatch(/stillschweigend|gilt als genehmigt|Gerichtsstand/);
  });
});

describe('order information', () => {
  it('states the total per month and the term', () => {
    const terms = contractTerms({ priceCents: 499, vatMode: 'standard' });
    const byLabel = Object.fromEntries(terms.map((term) => [term.label, term.value]));
    expect(byLabel.Preis).toMatch(/^4,99\s€ pro Monat\. Der Preis enthält 19 % Umsatzsteuer\.$/);
    expect(byLabel['Monatliche Gesamtkosten']).toMatch(/^4,99\s€/);
    expect(byLabel.Mindestlaufzeit).toBe('ein Monat');
    expect(byLabel.Kündigung).toContain('jederzeit zum Ende des laufenden Abrechnungsmonats');
  });

  it('only promises the photo analysis where it is available', () => {
    const pro = DEFAULT_ENTITLEMENTS.pro;
    expect(proFeatures(pro, { photoAnalysis: false }).join(' ')).not.toContain('Foto');
    expect(proFeatures(pro, { photoAnalysis: true }).join(' ')).toContain('Fotoanalyse');
  });
});
