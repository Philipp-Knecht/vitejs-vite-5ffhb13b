import { KBA_RECALL_DATABASE_URL, makeById, recallCheckFor } from '@kaufcheck/catalog';
import type { ReactNode } from 'react';
import { track } from '../../lib/analytics';

type Placement = 'result' | 'model';

function OutLink({
  href,
  source,
  placement,
  children,
}: {
  href: string;
  source: string;
  placement: Placement;
  children: ReactNode;
}) {
  return (
    <a
      className="recall-check__link"
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={() => track('recall_check_opened', { source, placement })}
    >
      {children}
      <span className="visually-hidden"> (öffnet in neuem Tab)</span>
    </a>
  );
}

/**
 * How a buyer finds out whether a particular car has open recalls. Only the
 * manufacturer knows that for a FIN, so this links to its official page, the
 * KBA database and the workshop – KaufCheck queries none of them itself.
 */
export function RecallCheck({
  makeId,
  placement,
  listingVin = null,
}: {
  makeId: string | null;
  placement: Placement;
  /** A FIN found in the listing text, shown for comparison with the papers. */
  listingVin?: string | null;
}) {
  const make = makeById(makeId);
  const check = make ? recallCheckFor(make.id) : null;
  const vinCheck = make && check?.lookup === 'vin' ? check : null;
  const infoPage = make && check?.lookup === 'info' ? check : null;
  const english = check?.language === 'en' ? ' (englisch)' : '';

  return (
    <div className="recall-check">
      <ol className="recall-check__steps">
        <li>
          <strong>FIN erfragen.</strong> Die Fahrzeug-Identifizierungsnummer (FIN, auch
          Fahrgestellnummer) steht im Fahrzeugschein (Zulassungsbescheinigung Teil I, Feld E) und
          oft unten an der Windschutzscheibe oder auf dem Typschild.
          {listingVin && (
            <>
              {' '}
              Im Inserat steht eine mögliche FIN:{' '}
              <span className="recall-check__vin">{listingVin}</span>. Vergleiche sie bei der
              Besichtigung mit dem Fahrzeugschein.
            </>
          )}
        </li>
        {make && vinCheck && (
          <li>
            <strong>Beim Hersteller prüfen.</strong> In der{' '}
            <OutLink href={vinCheck.url} source={make.id} placement={placement}>
              {`FIN-Abfrage von ${make.name}${english}`}
            </OutLink>{' '}
            siehst du, ob für dieses Auto laut Hersteller Rückrufe offen sind.
          </li>
        )}
        <li>
          <strong>
            {vinCheck ? 'Oder in einer Vertragswerkstatt' : 'In einer Vertragswerkstatt'} oder bei
            der Kundenhotline des Herstellers fragen.
          </strong>{' '}
          Dort sind offene Rückrufe zur FIN bekannt. Die Reparatur ist kostenlos (Material und
          Arbeitszeit).
        </li>
        {make && infoPage && (
          <li>
            <strong>Beim Hersteller nachlesen.</strong> Auf der{' '}
            <OutLink href={infoPage.url} source={make.id} placement={placement}>
              {`Rückrufseite von ${make.name}${english}`}
            </OutLink>{' '}
            informiert der Hersteller über Rückrufe; eine allgemeine Abfrage per FIN gibt es dort
            nicht.
          </li>
        )}
        <li>
          <strong>Rückrufe für das Modell nachschlagen.</strong> Die{' '}
          <OutLink href={KBA_RECALL_DATABASE_URL} source="kba" placement={placement}>
            Rückrufdatenbank des Kraftfahrt-Bundesamts
          </OutLink>{' '}
          zeigt Rückrufe nach Hersteller, Modell und Baujahr – nicht für ein einzelnes Auto und
          nicht jede Maßnahme der Hersteller.
        </li>
        <li>
          <strong>Belege zeigen lassen.</strong> Frag nach Werkstattbelegen zu erledigten Rückrufen.
        </li>
      </ol>
      <p className="recall-check__note">
        Anders als bei freiwilligen Serviceaktionen ist die Teilnahme an einem Rückruf Pflicht. Die
        Schreiben des Herstellers gehen an den eingetragenen Halter – nach dem Kauf also an dich.
        Wer sie ignoriert, riskiert, dass die Zulassungsbehörde den Betrieb des Autos untersagt.
      </p>
    </div>
  );
}
