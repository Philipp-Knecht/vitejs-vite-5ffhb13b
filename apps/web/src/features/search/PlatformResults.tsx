import { SEARCH_FIELD_LABELS, type PlatformSearchLink, type SearchField } from '@kaufcheck/catalog';
import type { ListingPlatform } from '@kaufcheck/shared';
import { ExternalLink } from 'lucide-react';
import { track } from '../../lib/analytics';

/** What each marketplace is good for – neutral, no rankings. */
const PLATFORM_INFO: Record<ListingPlatform, string> = {
  mobile_de: 'Größte Auswahl in Deutschland, viele Händler.',
  autoscout24: 'Großer Marktplatz, auch mit Angeboten aus dem Ausland.',
  kleinanzeigen: 'Viele Privatangebote – oft günstiger, aber genauer hinschauen.',
  ebay: 'Wenige Autos, teils als Auktion.',
  autohero: 'Online-Händler mit eigenen Autos und Lieferung.',
  pkw_de: 'Kleinere Börse mit Händlerangeboten.',
  facebook: 'Privatangebote aus der Umgebung, Anmeldung nötig.',
};

function appliedText(applied: SearchField[], requested: SearchField[]): string {
  if (requested.length === 0) return 'Öffnet die Suche der Plattform.';
  const carried = requested.filter((field) => applied.includes(field));
  const missing = requested.filter((field) => !applied.includes(field));
  const list = (fields: SearchField[]) =>
    fields.map((field) => SEARCH_FIELD_LABELS[field]).join(', ');
  if (missing.length === 0) return `Gibt deine Filter mit: ${list(carried)}.`;
  if (carried.length === 0) return `Filter (${list(missing)}) stellst du dort ein.`;
  return `Gibt ${list(carried)} mit; ${list(missing)} stellst du dort ein.`;
}

interface PlatformResultsProps {
  links: PlatformSearchLink[];
  /** Filters the visitor set, to say which ones each platform receives. */
  requested: SearchField[];
}

export function PlatformResults({ links, requested }: PlatformResultsProps) {
  return (
    <ul className="platform-results">
      {links.map((link) => (
        <li key={link.platform} className="platform-result">
          <div className="platform-result__text">
            <h3 className="platform-result__name">{link.name}</h3>
            <p className="platform-result__info">{PLATFORM_INFO[link.platform]}</p>
            <p className="platform-result__applied">{appliedText(link.applied, requested)}</p>
          </div>
          <a
            className="btn btn--secondary btn--md platform-result__link"
            href={link.url}
            target="_blank"
            rel="noopener nofollow"
            onClick={() => track('platform_search_opened', { source: link.platform })}
          >
            <span>Angebote bei {link.name}</span>
            <ExternalLink aria-hidden size={18} />
            <span className="visually-hidden"> (öffnet in neuem Tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
