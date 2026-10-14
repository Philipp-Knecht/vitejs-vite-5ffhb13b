import { findMake } from '@kaufcheck/catalog';
import type { Vehicle } from '@kaufcheck/shared';
import { RecallCheck } from '../recalls/RecallCheck';
import { ResultSection } from './Section';

/** Whether recalls are open for this car: links to the manufacturer and the KBA database. */
export function RecallSection({ vehicle }: { vehicle: Vehicle | null }) {
  return (
    <ResultSection
      id="rueckrufe"
      title="Rückrufe prüfen"
      lead="Mit Rückrufen beheben Hersteller Mängel, etwa an Bremsen, Airbags oder der Abgasreinigung – kostenlos, aber nur, wenn eine Werkstatt sie erledigt hat. Ob ein bestimmtes Auto betroffen ist, zeigt die Fahrgestellnummer."
    >
      <RecallCheck makeId={findMake(vehicle?.make)?.id ?? null} placement="result" />
    </ResultSection>
  );
}
