import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useHydratedConfig } from '../../api/queries';
import { useOfflineChecks } from '../../lib/offline';
import { useHydrated } from '../../lib/use-hydrated';
import { forgetCurrentChat, setCurrentChatId } from '../chat/chat-store';
import { HomeBar } from './HomeBar';
import { HomeDrawer } from './HomeDrawer';

/**
 * The bar and menu of the start page on every other page, so that KaufCheck looks the
 * same throughout. A chat chosen in the menu, or a new one, opens on the start page.
 */
export function SiteBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const offlineChecks = useOfflineChecks(hydrated);
  // Only once the configuration says the assistant is off are the chats closed to it.
  const config = useHydratedConfig();
  const chatOn = config === undefined || config.features.chat !== null;

  const openChat = (id: string) => {
    setCurrentChatId(id);
    void navigate('/');
  };
  const newChat = () => {
    forgetCurrentChat();
    void navigate('/');
  };

  return (
    <>
      <HomeBar
        menuId={menuId}
        menuOpen={menuOpen}
        menuButton={menuButton}
        onMenu={() => setMenuOpen(true)}
        onNewChat={chatOn ? newChat : null}
        sticky
      />
      <HomeDrawer
        id={menuId}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        returnFocus={menuButton}
        currentChatId={null}
        onOpenChat={chatOn ? openChat : null}
        onNewChat={chatOn ? newChat : null}
        offlineChecks={offlineChecks}
      />
    </>
  );
}
