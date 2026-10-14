import {
  buildNegotiationMessage,
  negotiationSuggestions,
  type Observation,
  type Vehicle,
} from '@kaufcheck/shared';
import { Copy, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useMe } from '../../api/queries';
import { Button, ButtonLink } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { copyText } from '../../lib/clipboard';
import { readJson, writeJson } from '../../lib/storage';
import { ResultSection } from './Section';
import { negotiationStorageKey } from './storage-keys';
import { useFormalAddress } from './use-formal-address';

const MAX_FINDINGS = 20;
const MAX_FINDING_LENGTH = 200;

interface NegotiationState {
  /** Ids of the suggestions from the listing that apply. */
  picked: string[];
  /** The buyer's own findings from the inspection. */
  findings: string[];
  offer: string;
}

const EMPTY: NegotiationState = { picked: [], findings: [], offer: '' };

const isState = (value: unknown): value is NegotiationState => {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  const strings = (items: unknown) =>
    Array.isArray(items) && items.every((item) => typeof item === 'string');
  return strings(state.picked) && strings(state.findings) && typeof state.offer === 'string';
};

/** Whole euros as typed („12.500“ or „12500“); `undefined` when invalid. */
function parseOffer(value: string): number | null | undefined {
  const compact = value.replace(/[\s.€]/g, '');
  if (compact === '') return null;
  if (!/^\d{1,8}$/.test(compact)) return undefined;
  const amount = Number(compact);
  return amount > 0 ? amount : undefined;
}

function Tips() {
  return (
    <ul className="negotiation__tips">
      <li>
        Leg dir vorher eine Preisgrenze fest, bleib sachlich und sei bereit, auf das Auto zu
        verzichten.
      </li>
      <li>
        Belege helfen: ein Kostenvoranschlag einer Werkstatt oder der Bericht eines
        Gebrauchtwagenchecks, etwa von TÜV, DEKRA oder ADAC.
      </li>
      <li>
        Schreib bekannte Mängel konkret in den Kaufvertrag. Wegen eines Mangels, den du beim Kauf
        kennst, kannst du später keine Rechte mehr geltend machen (§ 442 BGB) – verhandle also
        vorher.
      </li>
      <li>Lass dir Zusagen wie Unfallfreiheit oder Kilometerstand schriftlich geben.</li>
    </ul>
  );
}

/**
 * Prepares the price negotiation after the inspection (Pro): points from the
 * listing that apply, the buyer's own findings and a factual message to the
 * seller. KaufCheck suggests no amounts – it has no repair or market data.
 */
export function NegotiationSection({
  analysisId,
  observations,
  vehicle,
  vehicleTitle,
}: {
  analysisId: string;
  observations: Observation[];
  vehicle: Vehicle | null;
  vehicleTitle: string | null;
}) {
  const me = useMe();
  const toast = useToast();
  const [formal, setFormal] = useFormalAddress();
  const [state, setState] = useState<NegotiationState>(() => {
    const stored = readJson(negotiationStorageKey(analysisId), EMPTY, isState);
    return {
      ...stored,
      findings: stored.findings
        .slice(0, MAX_FINDINGS)
        .map((finding) => finding.slice(0, MAX_FINDING_LENGTH)),
    };
  });
  const [draft, setDraft] = useState('');

  const isPro = me.data?.entitlements.negotiationHelp ?? false;
  const suggestions = negotiationSuggestions(observations, vehicle);

  const update = (next: NegotiationState) => {
    setState(next);
    writeJson(negotiationStorageKey(analysisId), next);
  };

  const togglePick = (id: string) =>
    update({
      ...state,
      picked: state.picked.includes(id)
        ? state.picked.filter((item) => item !== id)
        : [...state.picked, id],
    });

  const addFinding = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.replace(/\s+/g, ' ').trim();
    if (text === '' || state.findings.length >= MAX_FINDINGS) return;
    update({ ...state, findings: [...state.findings, text] });
    setDraft('');
  };

  const removeFinding = (index: number) =>
    update({ ...state, findings: state.findings.filter((_, i) => i !== index) });

  const offer = parseOffer(state.offer);
  const points = [
    ...suggestions.filter((item) => state.picked.includes(item.id)).map((item) => item.text),
    ...state.findings,
  ];
  const message =
    points.length > 0 && offer !== undefined
      ? buildNegotiationMessage({ formal, vehicleTitle, points, offerEur: offer })
      : null;

  const copyMessage = async () => {
    if (!message) return;
    const ok = await copyText(message);
    toast.show(ok ? 'Nachricht kopiert' : 'Kopieren nicht möglich');
    if (ok) track('negotiation_message_copied', { count: points.length });
  };

  return (
    <ResultSection
      id="verhandlung"
      title="Verhandlung vorbereiten"
      lead="Halte nach der Besichtigung fest, was dir aufgefallen ist, und mach daraus eine sachliche Nachricht an den Verkäufer. Beträge schlägt KaufCheck nicht vor – dafür fehlen echte Reparatur- und Marktdaten."
    >
      {!isPro ? (
        <div className="negotiation__upsell">
          <p>
            Mit KaufCheck Pro hältst du deine Funde fest, wählst passende Punkte aus dem Inserat und
            erhältst eine fertige Nachricht in der Sie- oder Du-Form.
          </p>
          {me.data && (
            <ButtonLink
              to="/pro"
              variant="secondary"
              onClick={() => track('pro_clicked', { placement: 'negotiation' })}
            >
              KaufCheck Pro ansehen
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="negotiation">
          {suggestions.length > 0 && (
            <fieldset className="negotiation__group">
              <legend>Aus dem Inserat</legend>
              <p className="negotiation__hint">Wähle nur aus, was bei der Besichtigung zutraf.</p>
              <ul className="negotiation__list">
                {suggestions.map((suggestion) => {
                  const id = `negotiation-${suggestion.id}`;
                  return (
                    <li key={suggestion.id} className="negotiation__item">
                      <input
                        id={id}
                        type="checkbox"
                        className="checkbox"
                        checked={state.picked.includes(suggestion.id)}
                        onChange={() => togglePick(suggestion.id)}
                      />
                      <label htmlFor={id}>{suggestion.text}</label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}

          <div className="negotiation__group">
            <h3 className="negotiation__title">Deine Funde bei der Besichtigung</h3>
            {state.findings.length > 0 && (
              <ul className="negotiation__list">
                {state.findings.map((finding, index) => (
                  <li key={`${index}-${finding}`} className="negotiation__finding">
                    <span>{finding}</span>
                    <Button
                      variant="quiet"
                      size="sm"
                      icon={<X aria-hidden size={16} />}
                      aria-label={`„${finding}“ entfernen`}
                      onClick={() => removeFinding(index)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {state.findings.length < MAX_FINDINGS ? (
              <form className="negotiation__add" onSubmit={addFinding}>
                <TextField
                  label="Mangel oder Auffälligkeit"
                  hint="Zum Beispiel: Bremsen quietschen bei der Probefahrt"
                  maxLength={MAX_FINDING_LENGTH}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  icon={<Plus aria-hidden size={18} />}
                  disabled={draft.trim() === ''}
                >
                  Hinzufügen
                </Button>
              </form>
            ) : (
              <p className="negotiation__hint">Mehr als {MAX_FINDINGS} Punkte passen nicht.</p>
            )}
          </div>

          <div className="negotiation__group">
            <h3 className="negotiation__title">Nachricht an den Verkäufer</h3>
            <div className="negotiation__options">
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
              <TextField
                label="Dein Angebot in € (optional)"
                hint="Ohne Angebot fragt die Nachricht, wie der Verkäufer dir entgegenkommt."
                inputMode="numeric"
                error={offer === undefined ? 'Bitte gib einen Betrag in vollen Euro ein.' : null}
                value={state.offer}
                onChange={(event) => update({ ...state, offer: event.target.value })}
              />
            </div>
            {message ? (
              <>
                <p className="negotiation__message">{message}</p>
                <Button icon={<Copy aria-hidden size={18} />} onClick={() => void copyMessage()}>
                  Nachricht kopieren
                </Button>
              </>
            ) : (
              <p className="negotiation__hint">
                {points.length === 0
                  ? 'Wähle oder ergänze mindestens einen Punkt, dann entsteht hier die Nachricht.'
                  : 'Prüfe dein Angebot.'}
              </p>
            )}
          </div>
        </div>
      )}

      <h3 className="negotiation__title">So verhandelst du fair</h3>
      <Tips />
      <p className="negotiation__hint">Allgemeine Hinweise, keine Rechtsberatung.</p>
    </ResultSection>
  );
}
