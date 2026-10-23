import { findMake } from '@kaufcheck/catalog';
import { findVin, type NormalizedListing } from '@kaufcheck/shared';
import { Link } from 'react-router';
import { RecallCheck } from '../recalls/RecallCheck';
import { RECALL_LEAD } from '../recalls/texts';
import { ResultSection } from './Section';

/** „Import aus den Niederlanden“, „NL-Fahrzeug“, „holländische Papiere“. */
const FROM_NL =
  /niederl(?:a|ä)nd|holl(?:a|ä)nd|\bNL[-\s]?(?:import|fahrzeug|papiere|zulassung|kennzeichen)/i;

/** Whether recalls are open for this car: links to the manufacturer and the KBA database. */
export function RecallSection({
  listing,
}: {
  listing: Pick<NormalizedListing, 'title' | 'description' | 'vehicle'>;
}) {
  const text = `${listing.title ?? ''}\n${listing.description ?? ''}`;
  const vin = findVin(text);
  const fromNl = FROM_NL.test(text);
  return (
    <ResultSection id="rueckrufe" title="Rückrufe prüfen" lead={RECALL_LEAD}>
      <RecallCheck
        makeId={findMake(listing.vehicle?.make)?.id ?? null}
        placement="result"
        listingVin={vin?.vin ?? null}
      />
      {fromNl && (
        <p className="price-costs">
          Das Inserat nennt die Niederlande: Mit dem niederländischen Kennzeichen zeigt die RDW
          offene Rückrufe, ihre Bewertung des Kilometerstands und Mängel bei der APK.{' '}
          <Link to="/auto-aus-den-niederlanden">Auto aus den Niederlanden prüfen</Link>
        </p>
      )}
    </ResultSection>
  );
}
