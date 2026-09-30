import { MAX_LISTING_TEXT_LENGTH, MIN_LISTING_TEXT_LENGTH } from '@kaufcheck/shared';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { TextAreaField, TextField } from '../components/ui/Field';
import { AnalysisErrorPanel } from '../features/analysis/AnalysisErrorPanel';
import { AnalysisProgress } from '../features/analysis/AnalysisProgress';
import { CopyTextHelp } from '../features/analysis/CopyTextHelp';
import { useAnalysisRunner } from '../features/analysis/use-analysis-runner';
import { formatNumber } from '../lib/format';
import { appPageMeta } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

interface LocationState {
  url?: string;
  reason?: string;
}

const META = appPageMeta('Inseratstext prüfen');

export function TextInputPage() {
  usePageMeta(META);
  const location = useLocation();
  const incoming = (location.state ?? {}) as LocationState;
  const runner = useAnalysisRunner();
  const [text, setText] = useState('');
  const [url, setUrl] = useState(incoming.url ?? '');
  const [error, setError] = useState<string | null>(null);
  const { state } = runner;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length < MIN_LISTING_TEXT_LENGTH) {
      setError(
        'Bitte füge den vollständigen Inseratstext ein – mindestens Titel, Preis und Fahrzeugdetails.',
      );
      return;
    }
    if (trimmed.length > MAX_LISTING_TEXT_LENGTH) {
      setError('Der Text ist zu lang. Bitte füge nur das Inserat ein.');
      return;
    }
    setError(null);
    void runner.start({ kind: 'text', text: trimmed, url: url.trim() || undefined });
  };

  return (
    <div className="container page page--narrow">
      <h1>Inseratstext prüfen</h1>
      <p className="page__lead">
        Kopiere den Text des Auto-Inserats und füge ihn hier ein. KaufCheck liest daraus die Angaben
        aus – genauso wie bei einem Link.
      </p>

      {incoming.url && incoming.reason === 'retrieval_disabled' && (
        <Alert tone="info" title="KaufCheck ruft Inserate nicht selbst ab">
          <p>
            Kopiere den Text des Inserats und füge ihn unten ein – die Prüfung ist damit genauso
            ausführlich. Den Link speichern wir zur Zuordnung mit.
          </p>
        </Alert>
      )}
      {incoming.url && incoming.reason !== 'retrieval_disabled' && (
        <Alert tone="info" title="Dieses Inserat konnte nicht automatisch ausgelesen werden">
          <p>
            Kopiere den Text aus dem Inserat und füge ihn unten ein. Der Link wird zur Zuordnung
            mitgespeichert.
          </p>
        </Alert>
      )}

      {state.phase === 'running' ? (
        <AnalysisProgress
          stages={state.stages}
          kind={state.request.kind}
          onCancel={runner.cancel}
        />
      ) : (
        <>
          {state.phase === 'failed' && (
            <AnalysisErrorPanel
              error={state.error}
              request={state.request}
              onRetry={() => void runner.start(state.request)}
              onDismiss={runner.reset}
            />
          )}
          <form className="stack" onSubmit={submit} noValidate>
            <TextAreaField
              label="Inseratstext"
              rows={12}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (error) setError(null);
              }}
              placeholder={
                'z. B.\nVW Golf 1.4 TSI Highline\n8.450 € VB\nKilometerstand 142.000 km\nErstzulassung März 2014\n…'
              }
              hint={`${formatNumber(text.trim().length)} Zeichen · Telefonnummern und E-Mail-Adressen werden vor dem Speichern entfernt.`}
              error={error}
            />
            <TextField
              label="Link zum Inserat (optional)"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              hint="Nur zur Zuordnung – der Link wird nicht abgerufen."
            />
            <div>
              <Button type="submit" size="lg">
                Text prüfen
              </Button>
            </div>
          </form>
        </>
      )}

      <section className="page__section" aria-labelledby="copy-help-title">
        <h2 id="copy-help-title">So kopierst du den Text</h2>
        <CopyTextHelp />
      </section>
    </div>
  );
}
