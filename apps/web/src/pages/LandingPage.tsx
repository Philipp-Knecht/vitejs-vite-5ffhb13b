import { Scale, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useConfig, useHydratedConfig, useMe } from '../api/queries';
import { OfflineBanner, OfflineChecksNav } from '../components/layout/Layout';
import { ChatBoundary } from '../features/chat/ChatBoundary';
import { ChatPanel, ChatPlaceholder } from '../features/chat/ChatPanel';
import { deleteChat } from '../features/chat/chat-store';
import { useChat } from '../features/chat/use-chat';
import { HomeBar } from '../features/home/HomeBar';
import { HomeDrawer } from '../features/home/HomeDrawer';
import { LegalBar } from '../features/home/LegalBar';
import { track } from '../lib/analytics';
import { useOfflineChecks, useOnline } from '../lib/offline';
import { useHydrated } from '../lib/use-hydrated';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

/**
 * The start page is the assistant, laid out like a chat app: a bar with the
 * menu, the conversation filling the screen and the input at the bottom –
 * nothing to scroll. Everything else is in the menu or one question away.
 */
export function LandingPage() {
  const meta = STATIC_PAGE_META['/'];
  usePageMeta(meta ?? { title: 'KaufCheck', description: '' });
  const config = useHydratedConfig();
  const chatConfig = config?.features.chat ?? null;
  // The prerendered page shows an empty chat until the configuration says more: nothing jumps.
  const hydrated = useHydrated();
  const configQuery = useConfig();
  const chatPending = !hydrated || configQuery.isPending;
  const withChat = chatPending || chatConfig !== null;
  const me = useMe();
  const online = useOnline();
  const chat = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusInput, setFocusInput] = useState(0);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const offlineChecks = useOfflineChecks(hydrated);
  const chatReady = hydrated && chatConfig !== null && !chatPending;

  useEffect(() => track('landing_page_view'), []);

  const newChat = () => {
    chat.reset();
    setFocusInput((count) => count + 1);
  };

  return (
    <div className="home">
      <HomeBar
        menuId={menuId}
        menuOpen={menuOpen}
        menuButton={menuButton}
        onMenu={() => setMenuOpen(true)}
        onNewChat={chatReady && chat.items.length > 0 ? newChat : null}
      />
      <main id="inhalt" className="home__main" tabIndex={-1}>
        <OfflineBanner online={online} />
        {!online && <OfflineChecksNav checks={offlineChecks} />}
        <h1 className={withChat ? 'visually-hidden' : 'home__title'}>
          KaufCheck: Gebrauchtwagen finden, prüfen und durchrechnen
        </h1>
        {chatPending ? (
          <ChatPlaceholder />
        ) : chatConfig ? (
          <ChatBoundary onFailed={() => deleteChat(chat.id)} onRetry={chat.reset}>
            <ChatPanel
              chat={chat}
              isMock={chatConfig.isMock}
              dailyLimit={me.data?.plan === 'pro' ? chatConfig.dailyPro : chatConfig.dailyFree}
              focusInput={focusInput}
            />
          </ChatBoundary>
        ) : (
          <div className="home__start">
            <Link to="/auto-finden" className="btn btn--primary btn--lg">
              <Search aria-hidden size={20} />
              <span>Auto finden</span>
            </Link>
            <Link to="/inserat-pruefen" className="btn btn--secondary btn--lg">
              <Scale aria-hidden size={20} />
              <span>Inserat prüfen</span>
            </Link>
          </div>
        )}
      </main>
      <LegalBar />
      <HomeDrawer
        id={menuId}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        returnFocus={menuButton}
        currentChatId={chatReady ? chat.id : null}
        onOpenChat={chatReady ? chat.open : null}
        onNewChat={chatReady ? newChat : null}
        offlineChecks={offlineChecks}
      />
    </div>
  );
}
