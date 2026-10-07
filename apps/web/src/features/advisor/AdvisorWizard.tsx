import {
  BUDGETS,
  MILEAGE_LABELS,
  MILEAGES,
  PRIORITIES,
  PRIORITY_LABELS,
  USAGE_LABELS,
  USAGES,
  type AdvisorAnswers,
  type Priority,
} from '@kaufcheck/catalog';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { cn, formatNumber } from '../../lib/format';

interface Option {
  value: string;
  label: string;
}

interface Step {
  key: keyof AdvisorAnswers;
  question: string;
  hint?: string;
  options: Option[];
  /** Several answers (up to two). */
  multiple?: boolean;
  /** Can be skipped. */
  optional?: boolean;
}

const STEPS: readonly Step[] = [
  {
    key: 'budget',
    question: 'Wie viel möchtest du höchstens ausgeben?',
    hint: 'Plane zusätzlich etwas Reserve für Zulassung, Versicherung und erste Reparaturen ein.',
    options: BUDGETS.map((budget) => ({
      value: String(budget),
      label: `bis ${formatNumber(budget)} €`,
    })),
  },
  {
    key: 'usage',
    question: 'Wofür nutzt du das Auto vor allem?',
    options: USAGES.map((usage) => ({ value: usage, label: USAGE_LABELS[usage] })),
  },
  {
    key: 'people',
    question: 'Wie viele Personen fahren regelmäßig mit – dich eingeschlossen?',
    options: [
      { value: '2', label: '1–2 Personen' },
      { value: '4', label: '3–4 Personen' },
      { value: '5', label: '5 Personen' },
      { value: '7', label: '6–7 Personen' },
    ],
  },
  {
    key: 'mileage',
    question: 'Wie viel fährst du im Jahr?',
    hint: 'Davon hängt ab, welcher Antrieb sich lohnt.',
    options: MILEAGES.map((mileage) => ({ value: mileage, label: MILEAGE_LABELS[mileage] })),
    optional: true,
  },
  {
    key: 'charging',
    question: 'Kannst du zu Hause oder bei der Arbeit laden?',
    hint: 'Dann kommt auch ein Elektroauto infrage.',
    options: [
      { value: 'ja', label: 'Ja' },
      { value: 'nein', label: 'Nein oder weiß nicht' },
    ],
    optional: true,
  },
  {
    key: 'transmission',
    question: 'Schaltgetriebe oder Automatik?',
    options: [
      { value: 'egal', label: 'Egal' },
      { value: 'automatic', label: 'Automatik' },
      { value: 'manual', label: 'Schaltgetriebe' },
    ],
    optional: true,
  },
  {
    key: 'priorities',
    question: 'Was ist dir am wichtigsten?',
    hint: 'Wähle bis zu zwei Punkte.',
    options: PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] })),
    multiple: true,
    optional: true,
  },
];

function selected(answers: AdvisorAnswers, key: keyof AdvisorAnswers): string[] {
  const value = answers[key];
  if (Array.isArray(value)) return value;
  if (value === null) return [];
  if (key === 'charging') return [value ? 'ja' : 'nein'];
  return [String(value)];
}

function withAnswer(
  answers: AdvisorAnswers,
  key: keyof AdvisorAnswers,
  raw: string,
): AdvisorAnswers {
  switch (key) {
    case 'budget':
      return { ...answers, budget: Number(raw) };
    case 'people':
      return { ...answers, people: Number(raw) as AdvisorAnswers['people'] };
    case 'charging':
      return { ...answers, charging: raw === 'ja' };
    case 'transmission':
      return {
        ...answers,
        transmission: raw === 'egal' ? null : (raw as AdvisorAnswers['transmission']),
      };
    case 'priorities': {
      const priority = raw as Priority;
      const current = answers.priorities;
      const next = current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority].slice(-2);
      return { ...answers, priorities: next };
    }
    default:
      return { ...answers, [key]: raw };
  }
}

interface AdvisorWizardProps {
  initial: AdvisorAnswers;
  onComplete: (answers: AdvisorAnswers) => void;
}

/** One question at a time – a few clicks, no car jargon. */
export function AdvisorWizard({ initial, onComplete }: AdvisorWizardProps) {
  const [answers, setAnswers] = useState(initial);
  // "Egal" is a valid answer for the gearbox; remember that it was chosen.
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLLegendElement>(null);
  const moved = useRef(false);
  const step = STEPS[index] as Step;
  const values = selected(answers, step.key);
  const shown =
    step.key === 'transmission' && answered.has('transmission') && values.length === 0
      ? ['egal']
      : values;
  const canContinue = step.optional || values.length > 0;
  const last = index === STEPS.length - 1;

  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus();
  }, [index]);

  const go = (next: number) => {
    moved.current = true;
    setIndex(next);
  };

  return (
    <form
      className="advisor"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canContinue) return;
        if (last) onComplete(answers);
        else go(index + 1);
      }}
    >
      <div className="advisor__progress">
        <span>
          Frage {index + 1} von {STEPS.length}
        </span>
        <div className="meter" aria-hidden>
          <div
            className="meter__fill"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
      <fieldset className="advisor__step">
        <legend ref={heading} tabIndex={-1} className="advisor__question">
          {step.question}
        </legend>
        {step.hint && <p className="advisor__hint">{step.hint}</p>}
        <div className="choice-grid">
          {step.options.map((option) => {
            const checked = shown.includes(option.value);
            return (
              <label key={option.value} className={cn('choice', checked && 'is-checked')}>
                <input
                  type={step.multiple ? 'checkbox' : 'radio'}
                  name={step.key}
                  value={option.value}
                  checked={checked}
                  onChange={() => {
                    setAnswers((current) => withAnswer(current, step.key, option.value));
                    setAnswered((current) => new Set(current).add(step.key));
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="advisor__actions">
        {index > 0 && (
          <Button
            variant="ghost"
            icon={<ArrowLeft aria-hidden size={18} />}
            onClick={() => go(index - 1)}
          >
            Zurück
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={!canContinue}
          iconEnd={last ? <Sparkles aria-hidden size={18} /> : <ArrowRight aria-hidden size={18} />}
        >
          {last
            ? 'Vorschläge anzeigen'
            : step.optional && values.length === 0 && !answered.has(step.key)
              ? 'Überspringen'
              : 'Weiter'}
        </Button>
      </div>
    </form>
  );
}
