import { findMake } from '@kaufcheck/catalog';
import { findVin, type NormalizedListing } from '@kaufcheck/shared';
import { RecallCheck } from '../recalls/RecallCheck';
import { RECALL_LEAD } from '../recalls/texts';
import { ResultSection } from './Section';

/** Whether recalls are open for this car: links to the manufacturer and the KBA database. */
export function RecallSection({
  listing,
}: {
  listing: Pick<NormalizedListing, 'title' | 'description' | 'vehicle'>;
}) {
  const vin = findVin(`${listing.title ?? ''}\n${listing.description ?? ''}`);
  return (
    <ResultSection id="rueckrufe" title="Rückrufe prüfen" lead={RECALL_LEAD}>
      <RecallCheck
        makeId={findMake(listing.vehicle?.make)?.id ?? null}
        placement="result"
        listingVin={vin?.vin ?? null}
      />
    </ResultSection>
  );
}
