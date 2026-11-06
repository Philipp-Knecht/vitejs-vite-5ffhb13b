import {
  BUDGETS,
  EMPTY_ANSWERS,
  MILEAGE_LABELS,
  MILEAGES,
  PRIORITIES,
  PRIORITY_LABELS,
  toAdvisorParams,
  USAGE_LABELS,
  USAGES,
  type AdvisorAnswers,
  type Usage,
} from '@kaufcheck/catalog';
import {
  Building2,
  Calculator,
  CarFront,
  Caravan,
  ClipboardCheck,
  ClipboardList,
  Cog,
  Compass,
  FileSignature,
  FileText,
  Flag,
  Gauge,
  Handshake,
  Heart,
  Luggage,
  PiggyBank,
  PlugZap,
  Receipt,
  RotateCcw,
  Route,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { ADVISOR_AVAILABLE, MODEL_PAGES_AVAILABLE } from '../advisor/availability';

/**
 * The guided start of a new chat: one question at a time with fixed answers, chosen by
 * rules, not by the AI. It ends in a tool of KaufCheck that works without the AI (a page,
 * or a hint where to paste a listing) or, for finding suitable models, in a question to
 * the AI with everything answered so far. Typing into the chat works at any time.
 */

export type Tone = 'blue' | 'green' | 'violet' | 'amber' | 'teal' | 'rose';

export type GuideAction =
  /** The next question. */
  | { type: 'step'; to: StepId }
  /** A hint of the page in the chat, e.g. where to paste a listing. */
  | { type: 'hint'; text: string }
  /** A page of KaufCheck. */
  | { type: 'link'; to: string }
  /** Suitable models: the answers go to the AI as one question. */
  | { type: 'ask' };

export interface GuideAnswer {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  action: GuideAction;
  /** What this answer says about the person, for the car advisor. */
  set?: (answers: AdvisorAnswers) => AdvisorAnswers;
}

export interface GuideStep {
  question: string;
  /** A line under the question: what it is for, or what was answered so far. */
  note?: string;
  /** „Frage 2 von 7“ on the way to suitable models. */
  progress?: string;
  answers: GuideAnswer[];
}

export type StepId =
  | 'start'
  | 'budget'
  | 'usage'
  | 'people'
  | 'mileage'
  | 'charging'
  | 'transmission'
  | 'priority'
  | 'models'
  | 'model'
  | 'listing'
  | 'buying'
  | 'owner'
  | 'costs';

/** The questions on the way to suitable models, in order. */
const ADVISOR_STEPS: StepId[] = [
  'budget',
  'usage',
  'people',
  'mileage',
  'charging',
  'transmission',
  'priority',
];

const step = (to: StepId): GuideAction => ({ type: 'step', to });
const link = (to: string): GuideAction => ({ type: 'link', to });

export const PASTE_HINT =
  'Markier auf der Seite des Inserats den ganzen Text, kopier ihn und füg ihn unten ins Eingabefeld ein. Ich prüfe ihn sofort – Kontaktdaten entferne ich vorher.';

const USAGE_ICONS: Record<Usage, LucideIcon> = {
  stadt: Building2,
  pendeln: Route,
  familie: Users,
  gepaeck: Luggage,
  anhaenger: Caravan,
};

const PEOPLE_LABELS = { 2: '1–2 Personen', 4: '3–4 Personen', 5: '5 Personen', 7: '6–7 Personen' };

const TRANSMISSION_LABELS = { automatic: 'Automatik', manual: 'Schaltgetriebe' } as const;

/** What was answered on the way to suitable models, in words. */
export function advisorSummary(answers: AdvisorAnswers): string[] {
  const parts: string[] = [];
  if (answers.budget !== null) parts.push(`bis ${formatNumber(answers.budget)} €`);
  if (answers.usage) parts.push(USAGE_LABELS[answers.usage]);
  if (answers.people !== null) parts.push(PEOPLE_LABELS[answers.people]);
  if (answers.mileage) parts.push(`${MILEAGE_LABELS[answers.mileage]} im Jahr`);
  if (answers.charging !== null) parts.push(answers.charging ? 'kann laden' : 'kann nicht laden');
  if (answers.transmission) parts.push(TRANSMISSION_LABELS[answers.transmission]);
  if (answers.priorities.length > 0)
    parts.push(
      `am wichtigsten: ${answers.priorities.map((item) => PRIORITY_LABELS[item]).join(', ')}`,
    );
  return parts;
}

/** The question the AI gets for suitable models, with everything answered. */
export function advisorQuestion(answers: AdvisorAnswers): string {
  const parts = advisorSummary(answers);
  return `Welches Auto passt zu mir? ${parts.length > 0 ? `${parts.join(', ')}.` : ''}`.trim();
}

/** The car advisor's page with the answers filled in (no AI). */
export function advisorPage(answers: AdvisorAnswers): string {
  const params = toAdvisorParams(answers).toString();
  return params ? `/auto-berater?${params}` : '/auto-berater';
}

function advisorProgress(id: StepId): string | undefined {
  const index = ADVISOR_STEPS.indexOf(id);
  return index === -1 ? undefined : `Frage ${index + 1} von ${ADVISOR_STEPS.length}`;
}

/** The question shown at a step, with the answers to choose from. */
export function guideStep(id: StepId, answers: AdvisorAnswers): GuideStep {
  const progress = advisorProgress(id);
  switch (id) {
    case 'start':
      return {
        question: 'Wo stehst du gerade?',
        answers: [
          {
            label: 'Ich weiß noch nicht, was ich will',
            icon: Compass,
            tone: 'violet',
            action: step('budget'),
          },
          {
            label: 'Ich weiß, welches Auto ich will',
            icon: Search,
            tone: 'green',
            action: step('model'),
          },
          {
            label: 'Ich will ein Inserat prüfen',
            icon: ClipboardCheck,
            tone: 'blue',
            action: step('listing'),
          },
          {
            label: 'Ich habe mein Auto gefunden',
            icon: Handshake,
            tone: 'amber',
            action: step('buying'),
          },
          {
            label: 'Ich habe schon ein Auto',
            icon: CarFront,
            tone: 'teal',
            action: step('owner'),
          },
          {
            label: 'Ich will Kosten ausrechnen',
            icon: Calculator,
            tone: 'rose',
            action: step('costs'),
          },
        ],
      };
    case 'budget':
      return {
        question: 'Wie viel möchtest du höchstens ausgeben?',
        note: 'Plane zusätzlich etwas Reserve für Zulassung, Versicherung und erste Reparaturen ein.',
        progress,
        answers: BUDGETS.map((budget) => ({
          label: `bis ${formatNumber(budget)} €`,
          icon: Wallet,
          tone: 'amber' as const,
          action: step('usage'),
          set: (current) => ({ ...current, budget }),
        })),
      };
    case 'usage':
      return {
        question: 'Wofür nutzt du das Auto vor allem?',
        progress,
        answers: USAGES.map((usage) => ({
          label: USAGE_LABELS[usage],
          icon: USAGE_ICONS[usage],
          tone: 'green' as const,
          action: step('people'),
          set: (current) => ({ ...current, usage }),
        })),
      };
    case 'people':
      return {
        question: 'Wie viele Personen fahren regelmäßig mit – dich eingeschlossen?',
        progress,
        answers: ([2, 4, 5, 7] as const).map((people) => ({
          label: PEOPLE_LABELS[people],
          icon: people === 2 ? UserRound : Users,
          tone: 'blue' as const,
          action: step('mileage'),
          set: (current) => ({ ...current, people }),
        })),
      };
    case 'mileage':
      return {
        question: 'Wie viel fährst du im Jahr?',
        note: 'Davon hängt ab, welcher Antrieb sich lohnt.',
        progress,
        answers: [
          ...MILEAGES.map((mileage) => ({
            label: MILEAGE_LABELS[mileage],
            icon: Gauge,
            tone: 'teal' as const,
            action: step('charging'),
            set: (current: AdvisorAnswers) => ({ ...current, mileage }),
          })),
          {
            label: 'Weiß ich nicht',
            icon: Gauge,
            tone: 'teal',
            action: step('charging'),
            set: (current) => ({ ...current, mileage: null }),
          },
        ],
      };
    case 'charging':
      return {
        question: 'Kannst du zu Hause oder bei der Arbeit laden?',
        note: 'Dann kommt auch ein Elektroauto infrage.',
        progress,
        answers: [
          {
            label: 'Ja',
            icon: PlugZap,
            tone: 'green',
            action: step('transmission'),
            set: (current) => ({ ...current, charging: true }),
          },
          {
            label: 'Nein oder weiß nicht',
            icon: PlugZap,
            tone: 'green',
            action: step('transmission'),
            set: (current) => ({ ...current, charging: false }),
          },
        ],
      };
    case 'transmission':
      return {
        question: 'Schaltgetriebe oder Automatik?',
        progress,
        answers: [
          {
            label: 'Egal',
            icon: Cog,
            tone: 'violet',
            action: step('priority'),
            set: (current) => ({ ...current, transmission: null }),
          },
          {
            label: 'Automatik',
            icon: Cog,
            tone: 'violet',
            action: step('priority'),
            set: (current) => ({ ...current, transmission: 'automatic' }),
          },
          {
            label: 'Schaltgetriebe',
            icon: Cog,
            tone: 'violet',
            action: step('priority'),
            set: (current) => ({ ...current, transmission: 'manual' }),
          },
        ],
      };
    case 'priority':
      return {
        question: 'Was ist dir am wichtigsten?',
        progress,
        answers: [
          ...PRIORITIES.map((priority) => ({
            label: PRIORITY_LABELS[priority],
            icon: Heart,
            tone: 'rose' as const,
            action: step('models'),
            set: (current: AdvisorAnswers) => ({ ...current, priorities: [priority] }),
          })),
          {
            label: 'Nichts Bestimmtes',
            icon: Heart,
            tone: 'rose',
            action: step('models'),
            set: (current) => ({ ...current, priorities: [] }),
          },
        ],
      };
    case 'models': {
      const summary = advisorSummary(answers);
      return {
        question: 'Danke! Soll ich dir passende Modelle zeigen?',
        note: summary.length > 0 ? `Deine Angaben: ${summary.join(' · ')}` : undefined,
        answers: [
          {
            label: 'Ja, passende Modelle zeigen',
            icon: Sparkles,
            tone: 'violet',
            action: { type: 'ask' },
          },
          ...(ADVISOR_AVAILABLE
            ? [
                {
                  label: 'Im Auto-Berater ansehen',
                  icon: Compass,
                  tone: 'blue' as const,
                  action: link(advisorPage(answers)),
                },
              ]
            : []),
          {
            label: 'Nochmal von vorn',
            icon: RotateCcw,
            tone: 'teal',
            action: step('start'),
            set: () => EMPTY_ANSWERS,
          },
        ],
      };
    }
    case 'model':
      return {
        question: 'Wobei kann ich dir helfen?',
        answers: [
          {
            label: 'Suche für alle Börsen zusammenstellen',
            icon: Search,
            tone: 'green',
            action: link('/auto-finden'),
          },
          ...(MODEL_PAGES_AVAILABLE
            ? [
                {
                  label: 'Schwachstellen nachlesen',
                  icon: Wrench,
                  tone: 'rose' as const,
                  action: link('/modelle'),
                },
              ]
            : []),
          {
            label: 'Kosten durchrechnen',
            icon: Calculator,
            tone: 'amber',
            action: step('costs'),
          },
        ],
      };
    case 'listing':
      return {
        question: 'Woher stammt das Inserat?',
        answers: [
          {
            label: 'Von mobile.de, AutoScout24 & Co.',
            icon: ClipboardCheck,
            tone: 'blue',
            action: { type: 'hint', text: PASTE_HINT },
          },
          {
            label: 'Niederländisches Kennzeichen (RDW)',
            icon: Flag,
            tone: 'amber',
            action: link('/auto-aus-den-niederlanden'),
          },
          {
            label: 'Mehrere Inserate vergleichen',
            icon: Scale,
            tone: 'violet',
            action: {
              type: 'hint',
              text: 'Prüf die Inserate nacheinander: Füg den Text des ersten unten ins Eingabefeld ein, danach den nächsten. Mit einem Konto kannst du sie unter „Meine Angebote“ speichern und nebeneinander vergleichen.',
            },
          },
        ],
      };
    case 'buying':
      return {
        question: 'Was steht als Nächstes an?',
        answers: [
          {
            label: 'Inserat prüfen lassen',
            icon: ClipboardCheck,
            tone: 'blue',
            action: { type: 'hint', text: PASTE_HINT },
          },
          {
            label: 'Besichtigung und Probefahrt',
            icon: ClipboardList,
            tone: 'green',
            action: link('/auto-besichtigung-checkliste'),
          },
          {
            label: 'Kaufvertrag aufsetzen',
            icon: FileSignature,
            tone: 'blue',
            action: link('/kaufvertrag'),
          },
          {
            label: 'Finanzierung rechnen',
            icon: Wallet,
            tone: 'amber',
            action: link('/kfz-steuer-rechner#finanzierung'),
          },
          {
            label: 'Auto ummelden',
            icon: FileText,
            tone: 'violet',
            action: link('/auto-ummelden'),
          },
          {
            label: 'Alle Schritte als Checkliste',
            icon: ClipboardCheck,
            tone: 'teal',
            action: link('/gebrauchtwagen-checkliste'),
          },
        ],
      };
    case 'owner':
      return {
        question: 'Was möchtest du tun?',
        answers: [
          {
            label: 'HU, Service und Kosten im Blick',
            icon: CarFront,
            tone: 'teal',
            action: link('/mein-auto'),
          },
          {
            label: 'Rückrufe prüfen',
            icon: ShieldCheck,
            tone: 'blue',
            action: link('/auto-rueckruf-pruefen'),
          },
          {
            label: 'Auto verkaufen',
            icon: Tag,
            tone: 'green',
            action: link('/auto-verkaufen'),
          },
          {
            label: 'Kosten im Monat ausrechnen',
            icon: PiggyBank,
            tone: 'amber',
            action: link('/autokosten-im-monat'),
          },
        ],
      };
    case 'costs':
      return {
        question: 'Was möchtest du ausrechnen?',
        answers: [
          {
            label: 'Kfz-Steuer',
            icon: Receipt,
            tone: 'teal',
            action: link('/kfz-steuer-rechner'),
          },
          {
            label: 'Finanzierung',
            icon: Wallet,
            tone: 'amber',
            action: link('/kfz-steuer-rechner#finanzierung'),
          },
          {
            label: 'Alle Kosten im Monat',
            icon: PiggyBank,
            tone: 'green',
            action: link('/autokosten-im-monat'),
          },
          {
            label: 'Typklasse nachschlagen',
            icon: ShieldCheck,
            tone: 'blue',
            action: link('/kfz-steuer-rechner#typklasse'),
          },
        ],
      };
  }
}
