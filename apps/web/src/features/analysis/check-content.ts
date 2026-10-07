import { PLATFORM_NAMES, type ListingPlatform } from '@kaufcheck/shared';
import {
  FileSearch,
  HelpCircle,
  ListChecks,
  MessageSquareText,
  Scale,
  ShieldCheck,
} from 'lucide-react';

/** What the listing check shows – used on the homepage and the check page. */
export const CHECK_FEATURES = [
  {
    icon: FileSearch,
    title: 'Angaben geordnet',
    text: 'Kilometerstand, Erstzulassung, HU, Vorbesitzer, Scheckheft: Alles Wichtige auf einen Blick – mit Hinweis, woher jede Angabe stammt.',
  },
  {
    icon: HelpCircle,
    title: 'Lücken sichtbar',
    text: 'Was im Inserat fehlt, steht ausdrücklich als „Nicht angegeben“ da. So siehst du sofort, wonach du fragen musst.',
  },
  {
    icon: ShieldCheck,
    title: 'Auffälligkeiten mit Beleg',
    text: 'Widersprüche wie zwei verschiedene Kilometerstände oder erwähnte Schäden – immer mit der Stelle aus dem Inserat.',
  },
  {
    icon: MessageSquareText,
    title: 'Fragen an den Verkäufer',
    text: 'Passende Fragen in der Sie- oder Du-Form, fertig zum Kopieren oder als Nachricht für den Chat.',
  },
  {
    icon: ListChecks,
    title: 'Checkliste für die Besichtigung',
    text: 'Unterlagen, Karosserie, Innenraum und Probefahrt – zum Abhaken direkt auf dem Smartphone.',
  },
  {
    icon: Scale,
    title: 'Preis mit Augenmaß',
    text: 'Rechnungen wie Preis pro Jahr oder pro 10.000 km. Eine Marktpreis-Einschätzung gibt es nur mit genügend echten Vergleichsdaten.',
  },
];

/** Order: the largest German car marketplaces first. */
export const SUPPORTED_PLATFORMS: readonly ListingPlatform[] = [
  'mobile_de',
  'autoscout24',
  'kleinanzeigen',
  'ebay',
  'autohero',
  'pkw_de',
  'facebook',
];

export const PLATFORM_LIST = `${SUPPORTED_PLATFORMS.slice(0, -1)
  .map((platform) => PLATFORM_NAMES[platform])
  .join(', ')} und ${PLATFORM_NAMES.facebook}`;
