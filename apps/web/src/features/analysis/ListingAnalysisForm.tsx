import {
  ERROR_MESSAGES,
  MAX_LISTING_TEXT_LENGTH,
  MIN_LISTING_TEXT_LENGTH,
  recognizeListingUrl,
  type ListingUrlRejection,
} from '@kaufcheck/shared';
import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useConfig } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { TextAreaField } from '../../components/ui/Field';
import { AnalysisErrorPanel } from './AnalysisErrorPanel';
import { AnalysisProgress } from './AnalysisProgress';
import { CopyTextHelp } from './CopyTextHelp';
import { useAnalysisRunner } from './use-analysis-runner';

export const LISTING_INPUT_ID = 'inserat-eingabe';

const REJECTION_MESSAGES: Record<ListingUrlRejection, string> = {
  empty: 'Bitte füge den Text oder den Link eines Inserats ein.',
  too_long: 'Der Link ist zu lang. Bitte kopiere nur den Link zum Inserat.',
  not_a_url: ERROR_MESSAGES.INVALID_URL,
  invalid_protocol: ERROR_MESSAGES.INVALID_URL,
  credentials_not_allowed: ERROR_MESSAGES.INVALID_URL,
  port_not_allowed: ERROR_MESSAGES.INVALID_URL,
  unsupported_host:
    'KaufCheck prüft derzeit Auto-Inserate von kleinanzeigen.de. Den Text eines anderen Inserats kannst du trotzdem einfügen.',
  not_a_listing:
    'Das ist ein Link zu Kleinanzeigen, aber nicht zu einem einzelnen Inserat. Öffne das Inserat und kopiere dessen Link.',
};

/** A lone link (one token that looks like an address) rather than pasted listing text. */
function isSingleLink(value: string): boolean {
  return !/\s/.test(value) && /:\/\/|^www\.|kleinanzeigen\./i.test(value);
}

/**
 * The main input: the pasted text of a listing or a link to it. Where
 * automatic retrieval is off, a link leads to the text page, which explains
 * how to copy the listing text.
 */
export function ListingAnalysisForm() {
  const runner = useAnalysisRunner();
  const config = useConfig();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const { state } = runner;
  const retrieval = config.data?.features.urlRetrieval;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setError(REJECTION_MESSAGES.empty);
      return;
    }
    if (isSingleLink(value)) {
      const recognition = recognizeListingUrl(value);
      if (!recognition.ok) {
        setError(REJECTION_MESSAGES[recognition.reason]);
        return;
      }
      setError(null);
      if (retrieval === false) {
        void navigate('/inseratstext', {
          state: { url: recognition.canonicalUrl, reason: 'retrieval_disabled' },
        });
        return;
      }
      void runner.start({ kind: 'url', url: recognition.canonicalUrl });
      return;
    }
    if (value.length < MIN_LISTING_TEXT_LENGTH) {
      setError(
        'Das ist zu wenig für eine Prüfung. Füge den ganzen Inseratstext ein – mindestens Titel, Preis und Fahrzeugdaten.',
      );
      return;
    }
    if (value.length > MAX_LISTING_TEXT_LENGTH) {
      setError('Der Text ist zu lang. Bitte füge nur das Inserat ein.');
      return;
    }
    setError(null);
    void runner.start({ kind: 'text', text: value });
  };

  // Enter adds a line break in the text; Ctrl/⌘ + Enter submits.
  const submitOnShortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  if (state.phase === 'running') {
    return (
      <AnalysisProgress
        stages={state.stages}
        kind={state.request.kind}
        onCancel={() => {
          runner.cancel();
          // The form replaces the progress view; keep keyboard and screen reader focus on it.
          window.setTimeout(() => document.getElementById(LISTING_INPUT_ID)?.focus(), 0);
        }}
      />
    );
  }

  return (
    <div className="analyze">
      {state.phase === 'failed' ? (
        <AnalysisErrorPanel
          error={state.error}
          request={state.request}
          onRetry={() => void runner.start(state.request)}
          onDismiss={runner.reset}
        />
      ) : (
        <form className="url-form" onSubmit={submit} noValidate>
          <TextAreaField
            id={LISTING_INPUT_ID}
            label="Inseratstext oder Link zum Auto-Inserat"
            hideLabel
            className="url-form__field"
            rows={3}
            spellCheck={false}
            placeholder={
              retrieval
                ? 'Link oder Text des Inserats einfügen, z. B. https://www.kleinanzeigen.de/s-anzeige/…'
                : 'Text des Inserats hier einfügen – Titel, Preis, Kilometerstand, Beschreibung …'
            }
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={submitOnShortcut}
            hint={
              retrieval === false
                ? 'Links ruft KaufCheck nicht selbst ab – füge am besten den ganzen Text des Inserats ein.'
                : undefined
            }
            error={error}
          />
          <Button
            type="submit"
            size="lg"
            className="url-form__submit"
            iconEnd={<ArrowRight aria-hidden size={20} />}
          >
            Inserat prüfen
          </Button>
        </form>
      )}
      <p className="url-form__alternatives">
        <button
          type="button"
          className="link-button"
          aria-expanded={showHelp}
          aria-controls="copy-help"
          onClick={() => setShowHelp((open) => !open)}
        >
          So kopierst du den Inseratstext
        </button>
        <span aria-hidden className="url-form__separator">
          ·
        </span>
        <button
          type="button"
          className="link-button"
          onClick={() => void runner.start({ kind: 'example' })}
        >
          Fiktives Beispiel ansehen
        </button>
      </p>
      <div id="copy-help" className="url-form__help" hidden={!showHelp}>
        <CopyTextHelp />
      </div>
    </div>
  );
}
