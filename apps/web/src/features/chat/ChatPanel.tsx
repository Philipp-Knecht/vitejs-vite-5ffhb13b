import { CHAT_LIMITS, germanDay, type ChatCard, type ChatJump } from '@kaufcheck/shared';
import {
  ArrowRight,
  ArrowUp,
  CircleAlert,
  ClipboardCheck,
  Compass,
  FileText,
  Flag,
  Gauge,
  Loader2,
  Mic,
  PiggyBank,
  Receipt,
  Search,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/format';
import { isBoolean, readJson, writeJson } from '../../lib/storage';
import { ChatCardView } from './ChatCards';
import { ChatText } from './ChatText';
import { spokenAnswer } from './chat-labels';
import { safeHref } from './safe-href';
import type { Chat, ChatItem } from './use-chat';
import { useSpeech } from './use-speech';

type Tone = 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'teal';

const STARTERS: {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  card?: ChatCard;
  message?: string;
  hint?: string;
}[] = [
  {
    label: 'Inserat prüfen',
    icon: ClipboardCheck,
    tone: 'blue',
    hint: 'Markier auf der Seite des Inserats den ganzen Text, kopier ihn und füg ihn unten ins Eingabefeld ein. Ich prüfe ihn sofort – Kontaktdaten entferne ich vorher.',
  },
  {
    label: 'Auto finden',
    icon: Search,
    tone: 'green',
    card: { type: 'form', form: 'search', prefill: {} },
  },
  {
    label: 'Welches Auto passt zu mir?',
    icon: Compass,
    tone: 'violet',
    message: 'Welches Auto passt zu mir?',
  },
  {
    label: 'Finanzierung rechnen',
    icon: Wallet,
    tone: 'amber',
    card: { type: 'form', form: 'financing', prefill: {} },
  },
  {
    label: 'Kfz-Steuer berechnen',
    icon: Receipt,
    tone: 'teal',
    card: { type: 'form', form: 'tax', prefill: {} },
  },
  {
    label: 'Schwachstellen vom VW Golf',
    icon: Wrench,
    tone: 'rose',
    message: 'Welche Schwachstellen hat der VW Golf?',
  },
  {
    label: 'Auto aus den Niederlanden prüfen',
    icon: Flag,
    tone: 'blue',
    card: { type: 'form', form: 'rdw', prefill: {} },
  },
  {
    label: 'Worauf achte ich bei der Probefahrt?',
    icon: Gauge,
    tone: 'green',
    message: 'Worauf muss ich bei der Probefahrt achten?',
  },
  {
    label: 'Was kostet ein Auto im Monat?',
    icon: PiggyBank,
    tone: 'amber',
    message: 'Was kostet ein Auto im Monat?',
  },
  {
    label: 'Auto ummelden: Was brauche ich?',
    icon: FileText,
    tone: 'violet',
    message: 'Was brauche ich, um ein gekauftes Auto umzumelden?',
  },
];

/** When an answer failed: the tools work without the assistant. */
const FALLBACK_JUMPS: ChatJump[] = [
  { label: 'Zur Autosuche', href: '/auto-finden' },
  { label: 'Zur Inseratsprüfung', href: '/inserat-pruefen' },
];

const TITLE = 'KI-Assistent von KaufCheck';
const AI_NOTE = 'Antworten kommen von einer KI (Claude von Anthropic) und können Fehler enthalten.';
const PLACEHOLDER = 'KaufCheck fragen';
const INPUT_LABEL = 'Nachricht an den KI-Assistenten von KaufCheck';
const SPEECH_NOTE =
  'Spracheingabe: Die Sprache erkennt dein Browser. Meist schickt er die Aufnahme dafür an einen Online-Dienst, bei Chrome an Google. Die Diktierfunktion deiner Tastatur geht auch.';
/** Shown before the first use of the microphone; afterwards the button starts right away. */
const SPEECH_NOTE_KEY = 'kaufcheck:speech-note-seen';
/** A long pasted listing scrolls inside its bubble; from here on it can be reached by keyboard. */
const LONG_MESSAGE = 400;
const MAX_INPUT_HEIGHT = 200;

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
  const titleId = useId();
  return (
    <div className="chat__welcome">
      <p className="chat__welcome-lead">
        Willkommen bei KaufCheck, deinem KI-Assistenten für den Gebrauchtwagenkauf!
      </p>
      <p className="chat__welcome-title" id={titleId}>
        Was möchtest du machen?
      </p>
      {/* Three and a half suggestions show: the half one says there are more to scroll to. */}
      <ul className="chat__starters" aria-labelledby={titleId}>
        {STARTERS.map((starter, index) => (
          <li key={starter.label}>
            <button
              type="button"
              className="chat__starter"
              disabled={disabled}
              onClick={() => onStarter?.(index)}
            >
              <span className={`chat__starter-icon chat__starter-icon--${starter.tone}`}>
                <starter.icon aria-hidden size={18} />
              </span>
              <span className="chat__starter-label">{starter.label}</span>
            </button>
          </li>
        ))}
      </ul>
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
      {/* A check that is done stays reachable, also when the answer to it failed. */}
      {item.status === 'error' && (
        <Jumps jumps={item.jumps && item.jumps.length > 0 ? item.jumps : FALLBACK_JUMPS} />
      )}
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
    <div className="chat-jumps" role="group" aria-label="Selbst weitermachen">
      <span className="chat-jumps__label">Lieber selbst?</span>
      {safe.map((jump) => (
        <Link key={jump.href} to={jump.href} className="chat-jumps__link">
          {jump.label} <ArrowRight aria-hidden size={14} />
        </Link>
      ))}
    </div>
  );
}

/** What screen readers hear: the step while it works, the whole answer once it is done. */
function announcement(last: ChatItem | undefined): string {
  if (last?.role === 'hint') return last.text;
  if (last?.role !== 'assistant') return '';
  if (last.status === 'streaming') {
    const running = last.tools.findLast((step) => step.status === 'started');
    return `${running?.label ?? 'Der Assistent antwortet'} …`;
  }
  return last.status === 'done' ? spokenAnswer(last.text, last.cards, last.jumps ?? []) : '';
}

/** The microphone: before its first use, where the voice goes. */
function SpeechAsk({
  noteId,
  onStart,
  onCancel,
}: {
  noteId: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => start.current?.focus(), []);
  return (
    <div className="chat__speech-ask" role="group" aria-labelledby={noteId}>
      <p id={noteId}>{SPEECH_NOTE}</p>
      <div className="chat__speech-ask-actions">
        <button ref={start} type="button" className="btn btn--primary btn--sm" onClick={onStart}>
          <span>Spracheingabe starten</span>
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          <span>Abbrechen</span>
        </button>
      </div>
    </div>
  );
}

/**
 * The assistant on the start page: ask anything about finding, checking,
 * paying for and owning a used car; it uses KaufCheck's own functions and
 * shows their results as cards. The conversations stay on this device.
 */
export function ChatPanel({
  chat,
  isMock,
  dailyLimit,
  focusInput,
}: {
  chat: Chat;
  isMock: boolean;
  /** Messages per day for this visitor's plan, until the first answer says. */
  dailyLimit: number;
  /** Counts up when the input should get the focus, e.g. after „Neuer Chat“. */
  focusInput: number;
}) {
  const { id, items, usage, notice, busy, send, showForm, showHint } = chat;
  const [input, setInput] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [speechAsk, setSpeechAsk] = useState(false);
  const base = useRef('');
  const inputId = useId();
  const headingId = useId();
  const speechNoteId = useId();
  const speechAskId = useId();
  const lengthId = useId();
  const log = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const micButton = useRef<HTMLButtonElement>(null);
  const speech = useSpeech((spoken) =>
    setInput(`${base.current}${base.current && spoken ? ' ' : ''}${spoken}`),
  );
  // The input grows with its text, up to a limit; then it scrolls.
  useLayoutEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = 'auto';
    // On a low screen (a phone held sideways) the input leaves room for the conversation.
    const limit = Math.min(MAX_INPUT_HEIGHT, window.innerHeight / 4);
    element.style.height = `${Math.min(element.scrollHeight, Math.max(limit, 44))}px`;
  }, [input]);

  // New content scrolls into view, inside the log only.
  const last = items.at(-1);
  // A conversation restored or opened from the menu is not read out again, and
  // what was typed for the last one goes with it.
  const [quiet, setQuiet] = useState({ id, last: last?.id });
  if (quiet.id !== id) {
    setQuiet({ id, last: last?.id });
    // Deleted in another tab: what was typed here stays.
    if (!notice?.external) setInput('');
    setSpeechAsk(false);
  }
  const lastLength =
    last?.role === 'assistant' ? last.text.length + last.cards.length + last.tools.length : 0;
  useEffect(() => {
    const element = log.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    // On a low screen the page scrolls instead: it follows to the input, unless the
    // visitor scrolled up to read.
    const page = document.documentElement;
    const atEnd = page.scrollHeight - window.scrollY - window.innerHeight < 160;
    if (items.length > 0 && atEnd && window.matchMedia('(max-height: 520px)').matches)
      window.scrollTo({ top: page.scrollHeight });
  }, [id, items.length, lastLength]);

  /**
   * Where the focus goes when the control that had it disappears: the input.
   * On phones the conversation instead, so no keyboard pops up.
   */
  const focusAfterSend = () => {
    if (touchScreen()) {
      log.current?.focus({ preventScroll: true });
      return;
    }
    textarea.current?.focus({ preventScroll: true });
  };

  // „Neuer Chat“ (after the menu has given the focus back to its button).
  useEffect(() => {
    if (focusInput === 0) return;
    const frame = requestAnimationFrame(focusAfterSend);
    return () => cancelAnimationFrame(frame);
  }, [focusInput]);

  // Another conversation: the microphone stops listening for the last one.
  const cancelSpeech = speech.cancel;
  useEffect(() => cancelSpeech, [id, cancelSpeech]);

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

  const startSpeech = () => {
    base.current = input.trim();
    speech.start();
  };

  const toggleSpeech = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    if (!readJson(SPEECH_NOTE_KEY, false, isBoolean)) {
      setSpeechAsk(true);
      return;
    }
    startSpeech();
  };

  const onStarter = (index: number) => {
    const starter = STARTERS[index];
    if (starter?.card) setFocusId(showForm(starter.card));
    else if (starter?.message) sendMessage(starter.message);
    else if (starter?.hint) {
      showHint(starter.hint);
      // The listing goes into the input: there it is, ready for pasting.
      textarea.current?.focus({ preventScroll: true });
    }
  };

  const left = today ? Math.max(0, today.limit - today.used) : null;

  return (
    <section className="chat" aria-labelledby={headingId}>
      <h2 id={headingId} className="visually-hidden">
        {TITLE}
      </h2>
      <div
        className={cn('chat__log', items.length === 0 && 'chat__log--empty')}
        ref={log}
        role="region"
        aria-label="Gesprächsverlauf"
        // Scrollable by keyboard, also when it holds only text.
        tabIndex={0}
      >
        <div className="chat__column">
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
      </div>
      <p className="visually-hidden" role="status">
        {quiet.id === id && last?.id === quiet.last ? (notice?.text ?? '') : announcement(last)}
      </p>

      <div className="chat__bottom">
        {speechAsk && (
          <SpeechAsk
            noteId={speechAskId}
            onStart={() => {
              writeJson(SPEECH_NOTE_KEY, true);
              setSpeechAsk(false);
              startSpeech();
              micButton.current?.focus();
            }}
            onCancel={() => {
              setSpeechAsk(false);
              micButton.current?.focus();
            }}
          />
        )}
        <form className="chat__composer" onSubmit={submit}>
          <label htmlFor={inputId} className="visually-hidden">
            {INPUT_LABEL}
          </label>
          <textarea
            ref={textarea}
            id={inputId}
            className="chat__input"
            rows={1}
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
                ref={micButton}
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
              <ArrowUp aria-hidden size={20} />
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
        {speech.supported && (
          <p id={speechNoteId} className="visually-hidden">
            {SPEECH_NOTE}
          </p>
        )}
        <p className="chat__footer">
          {isMock ? 'Entwicklungsmodus: feste Regeln statt KI. ' : `${AI_NOTE} `}
          {exhausted
            ? `Für heute sind alle ${today.limit} Nachrichten verbraucht; morgen geht es weiter.`
            : left !== null
              ? `Heute noch ${left} von ${today?.limit ?? dailyLimit} Nachrichten.`
              : `${dailyLimit} Nachrichten am Tag kostenlos.`}
        </p>
      </div>
    </section>
  );
}

/**
 * The empty chat in the prerendered page, until the assistant is ready in the
 * browser: nothing jumps when it arrives.
 */
export function ChatPlaceholder() {
  return (
    <section className="chat" aria-label={TITLE} aria-busy>
      <div className="chat__log chat__log--empty">
        <div className="chat__column">
          <Welcome disabled />
        </div>
      </div>
      <div className="chat__bottom">
        <div className="chat__composer">
          <textarea
            className="chat__input"
            rows={1}
            placeholder={PLACEHOLDER}
            aria-label={INPUT_LABEL}
            disabled
          />
          <div className="chat__actions">
            <button type="button" className="chat__icon-button chat__send" disabled>
              <ArrowUp aria-hidden size={20} />
              <span className="visually-hidden">Senden</span>
            </button>
          </div>
        </div>
        <p className="chat__footer">{AI_NOTE}</p>
      </div>
    </section>
  );
}
