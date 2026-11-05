import { useCallback, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useConfig } from '../../api/queries';
import { useOfflineChecks } from '../../lib/offline';
import { useHydrated } from '../../lib/use-hydrated';
import type { StartRequest } from '../../pages/LandingPage';
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
  // Read only for the open menu: no page load waits on the cache for it.
  const offlineChecks = useOfflineChecks(hydrated && menuOpen);
  // As on the start page: the assistant counts as there until the configuration says
  // otherwise, or cannot be loaded (then the start page shows the tools instead).
  const config = useConfig();
  const chatOn =
    !hydrated ||
    (config.data
      ? config.data.features.chat !== null
      : config.isPending && config.fetchStatus !== 'paused');

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toStart = (request: StartRequest) => void navigate('/', { state: request });
  const openChat = (id: string) => toStart({ openChat: id });
  const newChat = () => toStart({ newChat: true });

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
        onOpen={openMenu}
        onClose={closeMenu}
        returnFocus={menuButton}
        currentChatId={null}
        onOpenChat={chatOn ? openChat : null}
        onNewChat={chatOn ? newChat : null}
        offlineChecks={offlineChecks}
      />
    </>
  );
}
