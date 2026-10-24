import type { ChatCard } from '@kaufcheck/shared';
import { Bot, CircleAlert, Loader2, Mic, MicOff, RotateCcw, SendHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/format';
import { ChatCardView } from './ChatCards';
import { ChatText } from './ChatText';
import { useChat, type ChatItem } from './use-chat';
import { useSpeech } from './use-speech';

const STARTERS: { label: string; card?: ChatCard; message?: string }[] = [
  { label: 'Inserat prüfen', card: { type: 'form', form: 'listing', prefill: {} } },
  { label: 'Auto finden', card: { type: 'form', form: 'search', prefill: {} } },
  { label: 'Finanzierung rechnen', card: { type: 'form', form: 'financing', prefill: {} } },
  { label: 'Kfz-Steuer berechnen', card: { type: 'form', form: 'tax', prefill: {} } },
  { label: 'Welches Auto passt zu mir?', message: 'Welches Auto passt zu mir?' },
];

function AssistantMessage({
  item,
  busy,
  onSubmit,
}: {
  item: Extract<ChatItem, { role: 'assistant' }>;
  busy: boolean;
  onSubmit: (message: string) => void;
}) {
  const working = item.status === 'streaming';
  const running = item.tools.filter((step) => step.status === 'started');
  return (
    <div className="chat-message chat-message--assistant" aria-busy={working || undefined}>
      {item.text && (
        <div className="chat-message__text">
          <ChatText text={item.text} />
        </div>
      )}
      {working && (running.length > 0 || !item.text) && (
        <p className="chat-message__status" role="status">
          <Loader2 aria-hidden size={16} className="spin" />
          {running[0]?.label ?? 'Denke nach'} …
        </p>
      )}
      {item.cards.map((card, index) => (
        <ChatCardView key={`${item.id}-${index}`} card={card} busy={busy} onSubmit={onSubmit} />
      ))}
      {item.status === 'error' && (
        <p className="chat-message__error" role="alert">
          <CircleAlert aria-hidden size={16} /> {item.error}
        </p>
      )}
      {item.fallback && (
        <p className="chat-message__note">
          Diese Antwort kommt von einem anderen Claude-Modell, weil das erste die Anfrage abgelehnt
          hat.
        </p>
      )}
    </div>
  );
}

/**
 * The assistant on the start page: ask anything about finding, checking,
 * paying for and owning a used car; it uses KaufCheck's own functions and
 * shows their results as cards. The conversation stays in this tab.
 */
export function ChatPanel({
  isMock,
  dailyLimit,
}: {
  isMock: boolean;
  /** Messages per day for this visitor's plan, until the first answer says. */
  dailyLimit: number;
}) {
  const { items, usage, busy, send, showForm, reset } = useChat();
  const [input, setInput] = useState('');
  const base = useRef('');
  const inputId = useId();
  const speechNoteId = useId();
  const log = useRef<HTMLDivElement>(null);
  const speech = useSpeech((spoken) =>
    setInput(`${base.current}${base.current && spoken ? ' ' : ''}${spoken}`),
  );

  // New content scrolls into view, inside the log only.
  const last = items.at(-1);
  const lastLength =
    last?.role === 'assistant' ? last.text.length + last.cards.length + last.tools.length : 0;
  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [items.length, lastLength]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (speech.listening) speech.stop();
    if (!input.trim() || busy) return;
    send(input);
    setInput('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const toggleSpeech = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    base.current = input.trim();
    speech.start();
  };

  const left = usage ? Math.max(0, usage.limit - usage.used) : null;

  return (
    <section className="chat" aria-label="KaufCheck-Assistent">
      <div className="chat__log" ref={log} role="log" aria-live="polite" aria-relevant="additions">
        {items.length === 0 && (
          <div className="chat__welcome">
            <p className="chat__welcome-title">
              <Bot aria-hidden size={20} /> Was kann ich für dich tun?
            </p>
            <p>
              Füg ein Inserat ein, und ich sag dir, ob der Preis passt und worauf du achten musst.
              Ich suche passende Autos auf allen großen Börsen, rechne Steuer und Finanzierung und
              helfe bis zum Kaufvertrag.
            </p>
            <div className="chat__starters">
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  className="chip-button"
                  disabled={busy}
                  onClick={() =>
                    starter.card ? showForm(starter.card) : starter.message && send(starter.message)
                  }
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((item) =>
          item.role === 'user' ? (
            <div key={item.id} className="chat-message chat-message--user">
              <p className="visually-hidden">Du:</p>
              <p className="chat-message__user-text">{item.text}</p>
            </div>
          ) : item.role === 'local' ? (
            <div key={item.id} className="chat-message chat-message--assistant">
              <ChatCardView card={item.card} busy={busy} onSubmit={send} />
            </div>
          ) : (
            <AssistantMessage key={item.id} item={item} busy={busy} onSubmit={send} />
          ),
        )}
      </div>

      <form className="chat__composer" onSubmit={submit}>
        <label htmlFor={inputId} className="visually-hidden">
          Nachricht an den KaufCheck-Assistenten
        </label>
        <textarea
          id={inputId}
          className="chat__input"
          rows={2}
          maxLength={12_000}
          placeholder="Frag etwas oder füg den Text eines Inserats ein …"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="chat__actions">
          {speech.supported && (
            <button
              type="button"
              className={cn('chat__icon-button', speech.listening && 'is-active')}
              aria-pressed={speech.listening}
              aria-describedby={speechNoteId}
              onClick={toggleSpeech}
            >
              {speech.listening ? <MicOff aria-hidden size={20} /> : <Mic aria-hidden size={20} />}
              <span className="visually-hidden">
                {speech.listening ? 'Spracheingabe beenden' : 'Spracheingabe starten'}
              </span>
            </button>
          )}
          <button
            type="submit"
            className="chat__icon-button chat__send"
            disabled={busy || !input.trim()}
          >
            <SendHorizontal aria-hidden size={20} />
            <span className="visually-hidden">Senden</span>
          </button>
        </div>
      </form>
      {speech.error && (
        <p className="chat__speech-error" role="alert">
          {speech.error}
        </p>
      )}

      <div className="chat__footer">
        <p>
          {isMock
            ? 'Entwicklungsmodus: feste Regeln statt KI. '
            : 'Der Assistent ist eine KI (Claude von Anthropic) und kann sich irren; Zahlen kommen aus den Rechnern von KaufCheck. '}
          {left !== null
            ? `Heute noch ${left} von ${usage?.limit ?? dailyLimit} Nachrichten.`
            : `${dailyLimit} Nachrichten am Tag kostenlos.`}{' '}
          <Link to="/datenschutz#assistent">Datenschutz</Link>
        </p>
        {speech.supported && (
          <p id={speechNoteId}>
            Spracheingabe: Die Sprache erkennt dein Browser. Meist schickt er die Aufnahme dafür an
            einen Online-Dienst, bei Chrome an Google. Die Diktierfunktion deiner Tastatur geht
            auch.
          </p>
        )}
        {items.length > 0 && (
          <button type="button" className="link-button chat__reset" onClick={reset}>
            <RotateCcw aria-hidden size={14} /> Neues Gespräch
          </button>
        )}
      </div>
    </section>
  );
}
