import type { Completeness } from '@kaufcheck/shared';
import { Check, Minus, X } from 'lucide-react';
import { ResultSection } from './Section';

export function CompletenessSection({ completeness }: { completeness: Completeness }) {
  const missing = completeness.fields.filter((field) => field.status === 'missing');
  const present = completeness.fields.filter((field) => field.status === 'present');
  const unchecked = completeness.fields.filter((field) => field.status === 'not_checkable');

  return (
    <ResultSection
      id="was-wissen-wir"
      title="Was wissen wir?"
      lead="Welche wichtigen Angaben das Inserat enthält – und welche fehlen."
    >
      <div className="completeness">
        <p className="completeness__score">
          <strong>
            {completeness.presentCount} von {completeness.checkableCount}
          </strong>{' '}
          wichtigen Angaben vorhanden
        </p>
        <div
          className="meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completeness.score}
          aria-label="Vollständigkeit der Angaben"
        >
          <div className="meter__fill" style={{ width: `${completeness.score}%` }} />
        </div>
      </div>

      <div className="completeness-columns">
        {missing.length > 0 && (
          <div>
            <h3 className="completeness-columns__title">Nicht angegeben</h3>
            <ul className="field-list">
              {missing.map((field) => (
                <li key={field.key} className="field-status field-status--missing">
                  <X aria-hidden size={16} />
                  <span>
                    <span className="field-status__label">{field.label}</span>
                    <span className="field-status__value">Nicht angegeben</span>
                    {field.note && <span className="field-status__note">{field.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {present.length > 0 && (
          <div>
            <h3 className="completeness-columns__title">Angegeben</h3>
            <ul className="field-list">
              {present.map((field) => (
                <li key={field.key} className="field-status field-status--present">
                  <Check aria-hidden size={16} />
                  <span>
                    <span className="field-status__label">{field.label}</span>
                    {field.value && <span className="field-status__value">{field.value}</span>}
                    {field.note && <span className="field-status__note">{field.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {unchecked.length > 0 && (
        <ul className="field-list field-list--compact">
          {unchecked.map((field) => (
            <li key={field.key} className="field-status field-status--unchecked">
              <Minus aria-hidden size={16} />
              <span>
                <span className="field-status__label">{field.label}</span>
                <span className="field-status__value">Nicht prüfbar</span>
                {field.note && <span className="field-status__note">{field.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ResultSection>
  );
}
