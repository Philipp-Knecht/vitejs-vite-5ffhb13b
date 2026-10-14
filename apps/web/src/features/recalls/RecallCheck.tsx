import { KBA_RECALL_DATABASE_URL, makeById, recallCheckFor } from '@kaufcheck/catalog';
import { ExternalLink } from 'lucide-react';
import { track } from '../../lib/analytics';

const LOOKUP_TEXT = {
  vin: 'Dort gibst du die FIN ein und siehst, ob für dieses Auto Rückrufe offen sind.',
  account:
    'Mit der FIN siehst du offene Rückrufe nach der Anmeldung im Kundenportal des Herstellers.',
  info: 'Dort informiert der Hersteller über laufende Rückrufe; eine Abfrage per FIN bietet die Seite nicht.',
} as const;

function OutLink({
  href,
  source,
  placement,
  children,
}: {
  href: string;
  source: string;
  placement: 'result' | 'model';
  children: string;
}) {
  return (
    <a
      className="btn btn--secondary btn--md"
      href={href}
      target="_blank"
      rel="noopener nofollow"
      onClick={() => track('recall_check_opened', { source, placement })}
    >
      <span>{children}</span>
      <ExternalLink aria-hidden size={18} />
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
}: {
  makeId: string | null;
  placement: 'result' | 'model';
}) {
  const make = makeById(makeId);
  const check = recallCheckFor(make?.id);

  return (
    <div className="recall-check">
      <ol className="recall-check__steps">
        <li>
          <strong>Fahrgestellnummer (FIN) erfragen.</strong> Sie steht im Fahrzeugschein
          (Zulassungsbescheinigung Teil I, Feld E) und meist gut lesbar unten an der
          Windschutzscheibe.
        </li>
        {make && check && (
          <li>
            <strong>Beim Hersteller prüfen.</strong> {LOOKUP_TEXT[check.lookup]}
          </li>
        )}
        <li>
          <strong>
            {check
              ? 'Oder in einer Vertragswerkstatt fragen.'
              : 'In einer Vertragswerkstatt fragen.'}
          </strong>{' '}
          Sie sieht offene Rückrufe zur FIN im System des Herstellers. Die Reparatur bei einem
          Rückruf ist kostenlos.
        </li>
        <li>
          <strong>Erledigte Rückrufe belegen lassen.</strong> Sie stehen meist im Serviceheft oder
          auf Werkstattrechnungen.
        </li>
      </ol>
      <div className="button-row">
        {make && check && (
          <OutLink href={check.url} source={make.id} placement={placement}>
            {`Rückrufe bei ${make.name}`}
          </OutLink>
        )}
        <OutLink href={KBA_RECALL_DATABASE_URL} source="kba" placement={placement}>
          Rückrufdatenbank des KBA
        </OutLink>
      </div>
      <p className="recall-check__note">
        Die Datenbank des Kraftfahrt-Bundesamts zeigt Rückrufe nach Hersteller, Modell und Baujahr –
        nicht für ein einzelnes Auto und nicht jede Maßnahme der Hersteller. Ob dein Wunschauto
        betroffen ist, sagt nur der Hersteller.
      </p>
    </div>
  );
}
