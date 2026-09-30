import type { ChecklistSection as Section } from '@kaufcheck/shared';
import { Printer, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { track } from '../../lib/analytics';
import { isStringArray, readJson, removeItem, writeJson } from '../../lib/storage';
import { ResultSection } from './Section';

const storageKey = (analysisId: string) => `kc:checklist:${analysisId}`;

/** Inspection checklist; progress is stored only in this browser. */
export function ChecklistSection({
  analysisId,
  sections,
}: {
  analysisId: string;
  sections: Section[];
}) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(readJson(storageKey(analysisId), [], isStringArray)),
  );
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (checked.size === 0 && next.size === 1) track('checklist_started');
    setChecked(next);
    writeJson(storageKey(analysisId), [...next]);
  };

  const reset = () => {
    setChecked(new Set());
    removeItem(storageKey(analysisId));
  };

  return (
    <ResultSection
      id="besichtigung"
      title="Checkliste für die Besichtigung"
      lead="Hake ab, was du vor Ort geprüft hast. Der Fortschritt wird nur in diesem Browser gespeichert."
      actions={
        <Button
          variant="quiet"
          size="sm"
          icon={<Printer aria-hidden size={16} />}
          onClick={() => window.print()}
        >
          Drucken
        </Button>
      }
    >
      <div className="checklist-progress">
        <p>
          <strong>
            {checked.size} von {total}
          </strong>{' '}
          Punkten erledigt
        </p>
        <div
          className="meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={checked.size}
          aria-label="Fortschritt der Checkliste"
        >
          <div
            className="meter__fill"
            style={{ width: total ? `${(checked.size / total) * 100}%` : '0%' }}
          />
        </div>
        {checked.size > 0 && (
          <Button
            variant="quiet"
            size="sm"
            icon={<RotateCcw aria-hidden size={16} />}
            onClick={reset}
          >
            Zurücksetzen
          </Button>
        )}
      </div>
      <div className="checklist-grid">
        {sections.map((section) => {
          const done = section.items.filter((item) => checked.has(item.id)).length;
          return (
            <fieldset key={section.id} className="checklist">
              <legend className="checklist__title">
                {section.title}
                <span className="checklist__count">
                  {done}/{section.items.length}
                </span>
              </legend>
              <ul>
                {section.items.map((item) => {
                  const id = `check-${section.id}-${item.id}`;
                  return (
                    <li key={item.id} className="checklist__item">
                      <input
                        id={id}
                        type="checkbox"
                        className="checkbox"
                        checked={checked.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                      <label htmlFor={id}>
                        <span className="checklist__label">{item.label}</span>
                        {item.hint && <span className="checklist__hint">{item.hint}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </ResultSection>
  );
}
