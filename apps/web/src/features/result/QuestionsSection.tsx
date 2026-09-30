import { buildSellerMessage, type SellerQuestion } from '@kaufcheck/shared';
import { Copy, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { EvidenceBadge } from '../../components/EvidenceBadge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextAreaField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { copyText } from '../../lib/clipboard';
import { isBoolean, readJson, writeJson } from '../../lib/storage';
import { ResultSection } from './Section';

const FORMAL_KEY = 'kc:formal-address';

function questionText(question: SellerQuestion, formal: boolean): string {
  return formal ? question.text : question.textInformal;
}

export function QuestionsSection({
  questions,
  vehicleTitle,
  listingUrl,
}: {
  questions: SellerQuestion[];
  vehicleTitle: string | null;
  listingUrl: string | null;
}) {
  const toast = useToast();
  const [formal, setFormalState] = useState(() => readJson(FORMAL_KEY, true, isBoolean));
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(() => new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [message, setMessage] = useState('');

  const setFormal = (value: boolean) => {
    setFormalState(value);
    writeJson(FORMAL_KEY, value);
  };

  const selected = questions.filter((question) => !deselected.has(question.id));

  const toggle = (id: string) =>
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copyAll = async () => {
    const text = questions
      .map((question, index) => `${index + 1}. ${questionText(question, formal)}`)
      .join('\n');
    const ok = await copyText(text);
    toast.show(ok ? 'Alle Fragen kopiert' : 'Kopieren nicht möglich');
    if (ok) track('seller_questions_copied', { count: questions.length });
  };

  const openComposer = () => {
    setMessage(
      buildSellerMessage({
        formal,
        vehicleTitle,
        questions: selected.map((question) => questionText(question, formal)),
      }),
    );
    setComposerOpen(true);
  };

  const copyMessage = async () => {
    const ok = await copyText(message);
    toast.show(ok ? 'Nachricht kopiert' : 'Kopieren nicht möglich');
    if (ok) track('seller_message_created', { count: selected.length });
  };

  return (
    <ResultSection
      id="fragen"
      title="Fragen an den Verkäufer"
      lead="Fragen zu den Lücken und Auffälligkeiten dieses Inserats. Wähle aus, welche in deine Nachricht sollen."
    >
      {questions.length === 0 ? (
        <p className="muted">Zu diesem Inserat gibt es keine offenen Fragen.</p>
      ) : (
        <>
          <div className="questions-toolbar">
            <div className="segmented" role="group" aria-label="Anrede">
              <button
                type="button"
                aria-pressed={formal}
                className="segmented__option"
                onClick={() => setFormal(true)}
              >
                Sie
              </button>
              <button
                type="button"
                aria-pressed={!formal}
                className="segmented__option"
                onClick={() => setFormal(false)}
              >
                du
              </button>
            </div>
            <p className="questions-toolbar__count" aria-live="polite">
              {selected.length} von {questions.length} ausgewählt
            </p>
          </div>

          <ol className="question-list">
            {questions.map((question) => {
              const checked = !deselected.has(question.id);
              const inputId = `question-${question.id}`;
              return (
                <li key={question.id} className="question">
                  <input
                    id={inputId}
                    type="checkbox"
                    className="checkbox"
                    checked={checked}
                    onChange={() => toggle(question.id)}
                  />
                  <div className="question__body">
                    <label htmlFor={inputId} className="question__text">
                      {questionText(question, formal)}
                    </label>
                    <details className="question__reason">
                      <summary>Warum diese Frage?</summary>
                      <p>{question.reason}</p>
                    </details>
                    <div className="question__meta">
                      {question.priority === 1 && (
                        <span className="tag tag--important">Wichtig</span>
                      )}
                      {question.origin === 'ai' && (
                        <EvidenceBadge evidence="inference" origin="ai" />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="button-row">
            <Button
              variant="secondary"
              icon={<Copy aria-hidden size={18} />}
              onClick={() => void copyAll()}
            >
              Alle Fragen kopieren
            </Button>
            <Button
              icon={<MessageSquarePlus aria-hidden size={18} />}
              onClick={openComposer}
              disabled={selected.length === 0}
            >
              Nachricht erstellen
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Nachricht an den Verkäufer"
        size="lg"
        footer={
          <>
            <Button icon={<Copy aria-hidden size={18} />} onClick={() => void copyMessage()}>
              Nachricht kopieren
            </Button>
            {listingUrl && (
              <a
                className="btn btn--secondary btn--md"
                href={listingUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <span>Inserat öffnen</span>
              </a>
            )}
          </>
        }
      >
        <TextAreaField
          label="Nachricht"
          rows={12}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          hint="Du kannst den Text anpassen. KaufCheck verschickt nichts – füge die Nachricht selbst im Chat auf Kleinanzeigen ein."
        />
      </Dialog>
    </ResultSection>
  );
}
