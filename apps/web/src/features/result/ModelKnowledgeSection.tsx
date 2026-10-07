import { loadKnowledge } from '@kaufcheck/catalog/knowledge';
import type { Vehicle } from '@kaufcheck/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ModelKnowledgeView } from '../search/ModelInsights';
import { ResultSection } from './Section';

/**
 * What ADAC, TÜV-Report and the trade press report about the listed model –
 * for the generation that matches its first registration.
 */
export function ModelKnowledgeSection({
  modelId,
  vehicle,
}: {
  modelId: string;
  vehicle: Vehicle | null;
}) {
  const knowledge = useQuery({
    queryKey: ['model-knowledge', modelId],
    queryFn: () => loadKnowledge(modelId),
    staleTime: Infinity,
  });
  if (!knowledge.data) return null;
  const model = knowledge.data;
  const year = vehicle?.firstRegistration?.year ?? null;
  const name = `${model.make} ${model.model}`;

  return (
    <ResultSection
      id="modell"
      title={`${name}: bekannte Schwachstellen`}
      lead={
        year
          ? `Passend zur Erstzulassung ${year}: Was ADAC, TÜV-Report und Fachpresse über dieses Modell berichten. Nicht jedes Auto ist betroffen – frag gezielt nach und achte bei der Besichtigung darauf.`
          : 'Was ADAC, TÜV-Report und Fachpresse über dieses Modell berichten. Nicht jedes Auto ist betroffen – frag gezielt nach und achte bei der Besichtigung darauf.'
      }
    >
      <ModelKnowledgeView model={model} yearMin={year} yearMax={year} compact />
      <p>
        <Link to={`/modelle/${model.id}`}>Alle Infos zu {name}</Link>
      </p>
    </ResultSection>
  );
}
