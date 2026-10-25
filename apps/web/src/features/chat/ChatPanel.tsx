import { CHAT_LIMITS, germanDay, type ChatCard, type ChatJump } from '@kaufcheck/shared';
import {
  ArrowRight,
  Bot,
  CircleAlert,
  Loader2,
  Mic,
  RotateCcw,
  SendHorizontal,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/format';
import { ChatCardView } from './ChatCards';
import { ChatText } from './ChatText';
import { spokenAnswer } from './chat-labels';
import { safeHref } from './safe-href';
import { useChat, type ChatItem } from './use-chat';
import { useSpeech } from './use-speech';

const STARTERS: { label: string; card?: ChatCard; message?: string; hint?: string }[] = [
  {
    label: 'Inserat prüfen',
    hint: 'Markier auf der Seite des Inserats den ganzen Text, kopier ihn und füg ihn unten ins Eingabefeld ein. Ich prüfe ihn sofort – Kontaktdaten entferne ich vorher.',
  },
  { label: 'Auto finden', card: { type: 'form', form: 'search', prefill: {} } },
  { label: 'Welches Auto passt zu mir?', message: 'Welches Auto passt zu mir?' },
  { label: 'Finanzierung rechnen', card: { type: 'form', form: 'financing', prefill: {} } },
  { label: 'Kfz-Steuer berechnen', card: { type: 'form', form: 'tax', prefill: {} } },
];

/** When an answer failed: the tools work without the assistant. */
const FALLBACK_JUMPS: ChatJump[] = [
  { label: 'Auto finden öffnen', href: '/auto-finden' },
  { label: 'Inserat prüfen öffnen', href: '/inserat-pruefen' },
];

const TITLE = 'KI-Assistent von KaufCheck';
const AI_NOTE =
  'Der Assistent ist eine KI (Claude von Anthropic) und kann sich irren; Zahlen kommen aus den Rechnern von KaufCheck.';
const PLACEHOLDER = 'Frag etwas oder füg den Text eines Inserats ein …';
const INPUT_LABEL = 'Nachricht an den KI-Assistenten von KaufCheck';
const SPEECH_NOTE =
  'Spracheingabe: Die Sprache erkennt dein Browser. Meist schickt er die Aufnahme dafür an einen Online-Dienst, bei Chrome an Google. Die Diktierfunktion deiner Tastatur geht auch.';
/** A long pasted listing scrolls inside its bubble; from here on it can be reached by keyboard. */
const LONG_MESSAGE = 400;

/** On phones Enter adds a line, and the keyboard should not pop up unasked. */
const touchScreen = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

function Welcome({
  disabled,
  onStarter,
}: {
  disabled: boolean;
  onStarter?: (index: number) => void;
}) {
  return (
    <div className="chat__welcome">
      <p className="chat__welcome-title">
        <Bot aria-hidden size={20} /> Willkommen bei KaufCheck, deinem KI-Assistenten für den
        Gebrauchtwagenkauf!
      </p>
      <p>Was möchtest du machen? Such dir etwas aus oder schreib einfach los.</p>
      <div className="chat__starters">
        {STARTERS.map((starter, index) => (
          <button
            key={starter.label}
            type="button"
            className="chip-button"
            disabled={disabled}
            onClick={() => onStarter?.(index)}
          >
            {starter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <div className="chat-message chat-message--assistant">
      {item.text && (
        <div className="chat-message__text">
          <ChatText text={item.text} />
        </div>
      )}
      {working && (running.length > 0 || !item.text) && (
        <p className="chat-message__status">
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
      {item.status === 'done' && <Jumps jumps={item.jumps ?? []} />}
      {item.status === 'error' && <Jumps jumps={FALLBACK_JUMPS} />}
    </div>
  );
}

/** Not happy with the answer? The tool of KaufCheck that does it, one tap away. */
function Jumps({ jumps }: { jumps: readonly ChatJump[] }) {
  const safe = jumps.flatMap((jump) => {
    const href = safeHref(jump.href);
    return href ? [{ label: jump.label, href }] : [];
  });
  if (safe.length === 0) return null;
  return (
    <nav className="chat-jumps" aria-label="Selbst weitermachen">
      <span className="chat-jumps__label">Lieber selbst?</span>
      {safe.map((jump) => (
        <Link key={jump.href} to={jump.href} className="chat-jumps__link">
          {jump.label} <ArrowRight aria-hidden size={14} />
        </Link>
      ))}
    </nav>
  );
}

/** What screen readers hear: the step while it works, the whole answer once it is done. */
function announcement(last: ChatItem | undefined): string {
  if (last?.role !== 'assistant') return '';
  if (last.status === 'streaming') {
    const running = last.tools.findLast((step) => step.status === 'started');
    return `${running?.label ?? 'Der Assistent antwortet'} …`;
  }
  return last.status === 'done' ? spokenAnswer(last.text, last.cards) : '';
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
  const { items, usage, busy, send, showForm, showHint, reset } = useChat();
  const [input, setInput] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const base = useRef('');
  const inputId = useId();
  const headingId = useId();
  const speechNoteId = useId();
  const lengthId = useId();
  const log = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech((spoken) =>
    setInput(`${base.current}${base.current && spoken ? ' ' : ''}${spoken}`),
  );

  // New content scrolls into view, inside the log only.
  const last = items.at(-1);
  // A conversation restored from the tab is not read out again.
  const [restoredLast] = useState(last?.id);
  const lastLength =
    last?.role === 'assistant' ? last.text.length + last.cards.length + last.tools.length : 0;
  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [items.length, lastLength]);

  /**
   * Where the focus goes when the control that had it disappears: the input,
   * kept in view. On phones the conversation instead, so no keyboard pops up.
   */
  const focusAfterSend = () => {
    if (touchScreen()) {
      log.current?.focus({ preventScroll: true });
      return;
    }
    textarea.current?.focus({ preventScroll: true });
    textarea.current?.scrollIntoView({ block: 'nearest' });
  };

  // Yesterday's count no longer applies.
  const today = usage !== null && germanDay(new Date()) < usage.resetsOn ? usage : null;
  const exhausted = today !== null && today.used >= today.limit;
  const tooLong = input.trim().length > CHAT_LIMITS.messageChars;

  const sendMessage = (text: string) => {
    send(text);
    focusAfterSend();
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!input.trim() || tooLong || busy || exhausted) return;
    // What the browser still hears after sending must not come back into the field.
    speech.cancel();
    send(input);
    setInput('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const composing = event.nativeEvent.isComposing || event.keyCode === 229;
    if (event.key === 'Enter' && !event.shiftKey && !composing && !touchScreen()) {
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

  const onStarter = (index: number) => {
    const starter = STARTERS[index];
    if (starter?.card) setFocusId(showForm(starter.card));
    else if (starter?.message) sendMessage(starter.message);
    else if (starter?.hint) {
      showHint(starter.hint);
      // The listing goes into the input: there it is, ready for pasting.
      textarea.current?.focus({ preventScroll: true });
      textarea.current?.scrollIntoView({ block: 'nearest' });
    }
  };

  const left = today ? Math.max(0, today.limit - today.used) : null;

  return (
    <section className="chat" aria-labelledby={headingId}>
      <h2 id={headingId} className="visually-hidden">
        {TITLE}
      </h2>
      <div
        className="chat__log"
        ref={log}
        role="region"
        aria-label="Gesprächsverlauf"
        // Scrollable by keyboard, also when it holds only text.
        tabIndex={0}
      >
        {items.length === 0 && <Welcome disabled={busy || exhausted} onStarter={onStarter} />}
        {items.map((item) =>
          item.role === 'user' ? (
            <div key={item.id} className="chat-message chat-message--user">
              <p className="visually-hidden">Du:</p>
              <p
                className="chat-message__user-text"
                {...(item.text.length > LONG_MESSAGE
                  ? { tabIndex: 0, role: 'region', 'aria-label': 'Deine Nachricht' }
                  : {})}
              >
                {item.text}
              </p>
            </div>
          ) : item.role === 'hint' ? (
            <div key={item.id} className="chat-message chat-message--assistant">
              <div className="chat-message__text">
                <ChatText text={item.text} />
              </div>
            </div>
          ) : item.role === 'local' ? (
            <div key={item.id} className="chat-message chat-message--assistant">
              <ChatCardView
                card={item.card}
                busy={busy || exhausted}
                autoFocus={item.id === focusId}
                onSubmit={sendMessage}
              />
            </div>
          ) : (
            <AssistantMessage
              key={item.id}
              item={item}
              busy={busy || exhausted}
              onSubmit={sendMessage}
            />
          ),
        )}
      </div>
      <p className="visually-hidden" role="status">
        {last?.id === restoredLast ? '' : announcement(last)}
      </p>

      <form className="chat__composer" onSubmit={submit}>
        <label htmlFor={inputId} className="visually-hidden">
          {INPUT_LABEL}
        </label>
        <textarea
          ref={textarea}
          id={inputId}
          className="chat__input"
          rows={2}
          placeholder={PLACEHOLDER}
          aria-describedby={tooLong ? lengthId : undefined}
          aria-invalid={tooLong || undefined}
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
              <Mic aria-hidden size={20} />
              <span className="visually-hidden">Spracheingabe</span>
            </button>
          )}
          <button
            type="submit"
            className="chat__icon-button chat__send"
            disabled={busy || exhausted || tooLong || !input.trim()}
          >
            <SendHorizontal aria-hidden size={20} />
            <span className="visually-hidden">Senden</span>
          </button>
        </div>
      </form>
      {tooLong && (
        <p id={lengthId} className="chat__speech-error">
          Der Text ist zu lang: höchstens {CHAT_LIMITS.messageChars.toLocaleString('de-DE')}{' '}
          Zeichen, gerade sind es {input.trim().length.toLocaleString('de-DE')}.
        </p>
      )}
      {speech.error && (
        <p className="chat__speech-error" role="alert">
          {speech.error}
        </p>
      )}

      <div className="chat__footer">
        <p>
          {isMock ? 'Entwicklungsmodus: feste Regeln statt KI. ' : `${AI_NOTE} `}
          {exhausted
            ? `Für heute sind alle ${today.limit} Nachrichten verbraucht; morgen geht es weiter.`
            : left !== null
              ? `Heute noch ${left} von ${today?.limit ?? dailyLimit} Nachrichten.`
              : `${dailyLimit} Nachrichten am Tag kostenlos.`}{' '}
          <Link to="/datenschutz#assistent">Datenschutz</Link>
        </p>
        {speech.supported && <p id={speechNoteId}>{SPEECH_NOTE}</p>}
        {items.length > 0 && (
          <button
            type="button"
            className="link-button chat__reset"
            onClick={() => {
              speech.cancel();
              reset();
              setInput('');
              focusAfterSend();
            }}
          >
            <RotateCcw aria-hidden size={14} /> Neues Gespräch
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * The empty chat in the prerendered page, until the assistant is ready in the
 * browser: the page below does not jump when it arrives.
 */
export function ChatPlaceholder() {
  return (
    <section className="chat" aria-label={TITLE} aria-busy>
      <div className="chat__log">
        <Welcome disabled />
      </div>
      <div className="chat__composer">
        <textarea
          className="chat__input"
          rows={2}
          placeholder={PLACEHOLDER}
          aria-label={INPUT_LABEL}
          disabled
        />
        <div className="chat__actions">
          <button type="button" className="chat__icon-button chat__send" disabled>
            <SendHorizontal aria-hidden size={20} />
            <span className="visually-hidden">Senden</span>
          </button>
        </div>
      </div>
      <div className="chat__footer">
        <p>
          {AI_NOTE} <Link to="/datenschutz#assistent">Datenschutz</Link>
        </p>
        <p>{SPEECH_NOTE}</p>
      </div>
    </section>
  );
}
