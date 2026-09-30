import { ERROR_MESSAGES, recognizeListingUrl, type ListingUrlRejection } from '@kaufcheck/shared';
import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useConfig } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { AnalysisErrorPanel } from './AnalysisErrorPanel';
import { AnalysisProgress } from './AnalysisProgress';
import { useAnalysisRunner } from './use-analysis-runner';

const REJECTION_MESSAGES: Record<ListingUrlRejection, string> = {
  empty: 'Bitte füge den Link zu einem Inserat ein.',
  too_long: 'Der Link ist zu lang. Bitte kopiere nur den Link zum Inserat.',
  not_a_url: ERROR_MESSAGES.INVALID_URL,
  invalid_protocol: ERROR_MESSAGES.INVALID_URL,
  credentials_not_allowed: ERROR_MESSAGES.INVALID_URL,
  port_not_allowed: ERROR_MESSAGES.INVALID_URL,
  unsupported_host:
    'KaufCheck kann derzeit nur Links von kleinanzeigen.de abrufen. Den Text eines anderen Inserats kannst du aber einfügen.',
  not_a_listing:
    'Das ist ein Link zu Kleinanzeigen, aber nicht zu einem einzelnen Inserat. Öffne das Inserat und kopiere dessen Link.',
};

export function UrlAnalysisForm() {
  const runner = useAnalysisRunner();
  const config = useConfig();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { state } = runner;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recognition = recognizeListingUrl(url);
    if (!recognition.ok) {
      setError(REJECTION_MESSAGES[recognition.reason]);
      return;
    }
    setError(null);
    if (config.data && !config.data.features.urlRetrieval) {
      void navigate('/inseratstext', {
        state: { url: recognition.canonicalUrl, reason: 'retrieval_disabled' },
      });
      return;
    }
    void runner.start({ kind: 'url', url: recognition.canonicalUrl });
  };

  if (state.phase === 'running') {
    return (
      <AnalysisProgress stages={state.stages} kind={state.request.kind} onCancel={runner.cancel} />
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
          <TextField
            id="inserat-link"
            label="Link zum Auto-Inserat auf Kleinanzeigen"
            hideLabel
            className="url-form__field"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://www.kleinanzeigen.de/s-anzeige/…"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              if (error) setError(null);
            }}
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
          onClick={() => void runner.start({ kind: 'example' })}
        >
          Fiktives Beispiel ansehen
        </button>
        <span aria-hidden className="url-form__separator">
          ·
        </span>
        <Link to="/inseratstext">Inseratstext einfügen</Link>
      </p>
    </div>
  );
}
