import {
  BookOpen,
  Bookmark,
  Calculator,
  Car,
  CarFront,
  CircleHelp,
  ClipboardCheck,
  Compass,
  MessagesSquare,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  CANCEL_BUTTON_LABEL,
  CANCEL_PATH,
  TERMS_PATH,
  WITHDRAW_BUTTON_LABEL,
  WITHDRAW_PATH,
} from '@kaufcheck/shared';
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link, NavLink } from 'react-router';
import { useMe } from '../../api/queries';
import { OfflineChecksNav } from '../../components/layout/Layout';
import { Logo } from '../../components/layout/Logo';
import { cn } from '../../lib/format';
import type { OfflineCheck } from '../../lib/offline';
import { ADVISOR_AVAILABLE, MODEL_PAGES_AVAILABLE } from '../advisor/availability';
import {
  CHAT_RETENTION_DAYS,
  deleteAllChats,
  deleteChat,
  useStoredChats,
} from '../chat/chat-store';
import { useDrawerSwipe } from './use-drawer-swipe';

interface Entry {
  to: string;
  label: string;
  icon: LucideIcon;
}

const FUNCTIONS: Entry[] = [
  { to: '/auto-finden', label: 'Auto finden', icon: Search },
  { to: '/inserat-pruefen', label: 'Inserat prüfen', icon: ClipboardCheck },
  ...(ADVISOR_AVAILABLE ? [{ to: '/auto-berater', label: 'Auto-Berater', icon: Compass }] : []),
  ...(MODEL_PAGES_AVAILABLE ? [{ to: '/modelle', label: 'Modelle', icon: Car }] : []),
  { to: '/kfz-steuer-rechner', label: 'Kfz-Steuer und Kosten', icon: Calculator },
  { to: '/meine-angebote', label: 'Meine Angebote', icon: Bookmark },
  { to: '/mein-auto', label: 'Mein Auto', icon: CarFront },
];

const GUIDES: { to: string; label: string }[] = [
  { to: '/gebrauchtwagen-kaufen', label: 'Gebrauchtwagen kaufen' },
  { to: '/gebrauchtwagen-checkliste', label: 'Checkliste Gebrauchtwagen' },
  { to: '/auto-besichtigung-checkliste', label: 'Checkliste Besichtigung' },
  { to: '/kaufvertrag', label: 'Kaufvertrag privat' },
  { to: '/auto-verkaufen', label: 'Auto verkaufen' },
  { to: '/auto-ummelden', label: 'Auto ummelden' },
  { to: '/auto-rueckruf-pruefen', label: 'Rückrufe prüfen' },
  { to: '/auto-aus-den-niederlanden', label: 'Auto aus den Niederlanden' },
  { to: '/autokosten-im-monat', label: 'Autokosten im Monat' },
];

function AccountEntry({ onNavigate }: { onNavigate: () => void }) {
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  return (
    <Link
      to={signedIn ? '/konto' : '/anmelden'}
      className="drawer__account"
      onClick={onNavigate}
      aria-label={signedIn ? 'Konto' : 'Anmelden'}
    >
      <UserRound aria-hidden size={20} />
    </Link>
  );
}

/** The kept conversations, newest first, each one to open or delete. */
function PastChats({
  currentId,
  onOpen,
}: {
  currentId: string | null;
  onOpen: ((id: string) => void) | null;
}) {
  const chats = useStoredChats();
  const headingId = useId();
  const [confirming, setConfirming] = useState(false);
  // The page behind the open menu is inert: deletions are announced here.
  const [deleted, setDeleted] = useState('');
  // Emptied first, so that the same text (two chats with one title) is announced again.
  const announce = (text: string) => {
    setDeleted('');
    requestAnimationFrame(() => setDeleted(text));
  };
  const confirmButton = useRef<HTMLButtonElement>(null);
  const deleteAllButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
  }, [confirming]);

  // The deleted row is gone: the focus goes to the next one, or to the heading.
  const remove = (index: number, id: string, title: string) => {
    deleteChat(id);
    announce(`Chat „${title}“ gelöscht.`);
    requestAnimationFrame(() => {
      const buttons = list.current?.querySelectorAll<HTMLButtonElement>('.drawer__chat');
      const next = buttons?.[Math.min(index, (buttons?.length ?? 1) - 1)];
      (next ?? heading.current)?.focus();
    });
  };

  return (
    <section className="drawer__section drawer__chats" aria-labelledby={headingId}>
      <h2 id={headingId} ref={heading} className="drawer__heading" tabIndex={-1}>
        Chats
      </h2>
      <p className="visually-hidden" role="status">
        {deleted}
      </p>
      {chats.length === 0 ? (
        <p className="drawer__note">
          Noch keine Chats. Sie bleiben nur auf diesem Gerät und werden nach {CHAT_RETENTION_DAYS}{' '}
          Tagen ohne neue Nachricht gelöscht.
        </p>
      ) : (
        <>
          <ul className="drawer__chat-list" ref={list}>
            {chats.map((chat, index) => (
              <li key={chat.id} className="drawer__chat-row">
                <button
                  type="button"
                  className={cn('drawer__chat', chat.id === currentId && 'is-current')}
                  aria-current={chat.id === currentId ? 'true' : undefined}
                  disabled={!onOpen}
                  onClick={() => onOpen?.(chat.id)}
                >
                  {chat.title}
                </button>
                <button
                  type="button"
                  className="drawer__chat-delete"
                  aria-label={`Chat „${chat.title}“ löschen`}
                  onClick={() => remove(index, chat.id, chat.title)}
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="drawer__note">
            Nur auf diesem Gerät gespeichert; nach {CHAT_RETENTION_DAYS} Tagen ohne neue Nachricht
            gelöscht.
          </p>
          {confirming ? (
            <div className="drawer__confirm" role="group" aria-label="Alle Chats löschen?">
              <span>Alle Chats auf diesem Gerät löschen?</span>
              <button
                ref={confirmButton}
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  deleteAllChats();
                  setConfirming(false);
                  announce('Alle Chats gelöscht.');
                  requestAnimationFrame(() => heading.current?.focus());
                }}
              >
                <span>Ja, löschen</span>
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setConfirming(false);
                  requestAnimationFrame(() => deleteAllButton.current?.focus());
                }}
              >
                <span>Abbrechen</span>
              </button>
            </div>
          ) : (
            <button
              ref={deleteAllButton}
              type="button"
              className="link-button drawer__delete-all"
              onClick={() => setConfirming(true)}
            >
              Alle Chats löschen
            </button>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The menu of the start page, like the side bar of a chat app: KaufCheck's
 * functions and pages first, the kept conversations below. A swipe right opens it,
 * a swipe left closes it.
 */
export function HomeDrawer({
  id,
  open,
  onOpen,
  onClose,
  returnFocus,
  currentChatId,
  onOpenChat,
  onNewChat,
  offlineChecks,
}: {
  id: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  currentChatId: string | null;
  /** Null when the assistant is off: the list stays, opening does not. */
  onOpenChat: ((id: string) => void) | null;
  onNewChat: (() => void) | null;
  offlineChecks: readonly OfflineCheck[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const me = useMe();
  const pro = me.data?.plan === 'pro';

  const close = useCallback(() => {
    onClose();
    // Not every browser returns the focus to the menu button by itself.
    requestAnimationFrame(() => returnFocus.current?.focus());
  }, [onClose, returnFocus]);
  // Pulled open by a swipe: shown before it is open.
  const pulling = useDrawerSwipe({ dialog: ref, open, onOpen, onClose: close });
  const shown = open || pulling;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (shown && !dialog.open) dialog.showModal();
    if (!shown && dialog.open) {
      dialog.close();
      // Opened by a swipe, it went without the slide-in; the next time it slides in again.
      dialog.style.animation = '';
    }
  }, [shown]);

  return (
    <dialog
      ref={ref}
      id={id}
      className="drawer"
      aria-label="KaufCheck-Menü"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop targets the dialog element itself.
        if (event.target === event.currentTarget) close();
      }}
    >
      {shown && (
        <div className="drawer__panel">
          <div className="drawer__top">
            <p className="drawer__title">
              <Logo />
            </p>
            <button
              type="button"
              className="icon-button"
              onClick={close}
              aria-label="Menü schließen"
            >
              <X aria-hidden size={22} />
            </button>
          </div>
          <div className="drawer__scroll">
            <nav className="drawer__section" aria-label="Funktionen und Seiten">
              <ul className="drawer__links">
                {/* Back to the assistant from every other page, with the chat open there. */}
                <li>
                  <NavLink to="/" end className="drawer__link" onClick={onClose}>
                    <MessagesSquare aria-hidden size={20} />
                    <span>{onNewChat ? 'Chat' : 'Startseite'}</span>
                  </NavLink>
                </li>
                {FUNCTIONS.map((entry) => (
                  <li key={entry.to}>
                    <NavLink to={entry.to} className="drawer__link" onClick={onClose}>
                      <entry.icon aria-hidden size={20} />
                      <span>{entry.label}</span>
                    </NavLink>
                  </li>
                ))}
                <li>
                  <details className="drawer__guides">
                    <summary className="drawer__link">
                      <BookOpen aria-hidden size={20} />
                      <span>Ratgeber</span>
                    </summary>
                    <ul className="drawer__sublinks">
                      {GUIDES.map((guide) => (
                        <li key={guide.to}>
                          <NavLink to={guide.to} className="drawer__sublink" onClick={onClose}>
                            {guide.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
                <li>
                  <NavLink to="/haeufige-fragen" className="drawer__link" onClick={onClose}>
                    <CircleHelp aria-hidden size={20} />
                    <span>Häufige Fragen</span>
                  </NavLink>
                </li>
                {!pro && (
                  <li>
                    <NavLink to="/pro" className="drawer__link" onClick={onClose}>
                      <Sparkles aria-hidden size={20} />
                      <span>KaufCheck Pro</span>
                    </NavLink>
                  </li>
                )}
              </ul>
            </nav>
            <OfflineChecksNav
              checks={offlineChecks}
              onNavigate={onClose}
              className="drawer__section drawer__offline"
            />
            <PastChats
              currentId={currentChatId}
              onOpen={
                onOpenChat &&
                ((chatId) => {
                  onOpenChat(chatId);
                  close();
                })
              }
            />
            <nav className="drawer__section drawer__legal" aria-label="Rechtliches im Menü">
              <Link to="/impressum" onClick={onClose}>
                Impressum
              </Link>
              <Link to="/datenschutz" onClick={onClose}>
                Datenschutz
              </Link>
              <Link to={TERMS_PATH} onClick={onClose}>
                AGB
              </Link>
              <Link to={CANCEL_PATH} onClick={onClose}>
                {CANCEL_BUTTON_LABEL}
              </Link>
              <Link to={WITHDRAW_PATH} onClick={onClose}>
                {WITHDRAW_BUTTON_LABEL}
              </Link>
            </nav>
          </div>
          <div className="drawer__bottom">
            {onNewChat && (
              <button
                type="button"
                className="btn btn--primary drawer__new"
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
              >
                <SquarePen aria-hidden size={18} />
                <span>Neuer Chat</span>
              </button>
            )}
            <AccountEntry onNavigate={onClose} />
          </div>
        </div>
      )}
    </dialog>
  );
}
