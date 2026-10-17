import { fragmentId } from '@kaufcheck/shared';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { NavigationType, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { useConfig } from './api/queries';
import { Layout } from './components/layout/Layout';
import { PageLoading } from './components/ui/Spinner';
import { ToastProvider } from './components/ui/ToastProvider';
import { configureAnalytics } from './lib/analytics';
import { BuyingGuidePage } from './pages/guides/BuyingGuidePage';
import { ChecklistGuidePage } from './pages/guides/ChecklistGuidePage';
import { InspectionGuidePage } from './pages/guides/InspectionGuidePage';
import { SaleContractPage } from './pages/guides/SaleContractPage';
import { SellingGuidePage } from './pages/guides/SellingGuidePage';
import { TaxGuidePage } from './pages/guides/TaxGuidePage';
import { AdvisorPage } from './pages/AdvisorPage';
import { CheckListingPage } from './pages/CheckListingPage';
import { FindCarPage } from './pages/FindCarPage';
import { LandingPage } from './pages/LandingPage';
import { ModelPage } from './pages/ModelPage';
import { ModelsPage } from './pages/ModelsPage';
import { CancelContractPage, WithdrawContractPage } from './features/contracts/ContractNoticePages';
import { TermsPage, WithdrawalPolicyPage } from './pages/legal/ContractDocuments';
import { BotPage, ImprintPage, PrivacyPage } from './pages/legal/LegalPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProPage } from './pages/ProPage';

// Prerendered pages are imported eagerly (they are hydrated); app pages load on demand.
const TextInputPage = lazy(() =>
  import('./pages/TextInputPage').then((module) => ({ default: module.TextInputPage })),
);
const ResultPage = lazy(() =>
  import('./features/result/ResultPage').then((module) => ({ default: module.ResultPage })),
);
const SavedListingsPage = lazy(() =>
  import('./features/saved/SavedListingsPage').then((module) => ({
    default: module.SavedListingsPage,
  })),
);
const MyCarPage = lazy(() =>
  import('./features/my-car/MyCarPage').then((module) => ({ default: module.MyCarPage })),
);
const CarLogPage = lazy(() =>
  import('./features/car-log/CarLogPage').then((module) => ({ default: module.CarLogPage })),
);
const RemindersPage = lazy(() =>
  import('./features/reminders/RemindersPage').then((module) => ({
    default: module.RemindersPage,
  })),
);
const ConfirmRemindersPage = lazy(() =>
  import('./features/reminders/ReminderLinkPages').then((module) => ({
    default: module.ConfirmRemindersPage,
  })),
);
const UnsubscribeReminderPage = lazy(() =>
  import('./features/reminders/ReminderLinkPages').then((module) => ({
    default: module.UnsubscribeReminderPage,
  })),
);
const ComparePage = lazy(() =>
  import('./features/compare/ComparePage').then((module) => ({ default: module.ComparePage })),
);
const HistoryPage = lazy(() =>
  import('./features/history/HistoryPage').then((module) => ({ default: module.HistoryPage })),
);
const AccountPage = lazy(() =>
  import('./features/account/AccountPage').then((module) => ({ default: module.AccountPage })),
);
const LoginPage = lazy(() =>
  import('./features/account/AuthPages').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./features/account/AuthPages').then((module) => ({ default: module.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('./features/account/AuthPages').then((module) => ({ default: module.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./features/account/AuthPages').then((module) => ({ default: module.ResetPasswordPage })),
);
const OrderPage = lazy(() =>
  import('./features/contracts/OrderPages').then((module) => ({ default: module.OrderPage })),
);
const OrderDonePage = lazy(() =>
  import('./features/contracts/OrderPages').then((module) => ({ default: module.OrderDonePage })),
);

function focusContent() {
  window.scrollTo(0, 0);
  document.getElementById('inhalt')?.focus({ preventScroll: true });
}

/** Scrolls to an element and moves the focus there, so that screen readers follow. */
function showSection(target: HTMLElement) {
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.scrollIntoView();
  target.focus({ preventScroll: true });
}

/**
 * Scrolls to the section of a link like /kfz-steuer-rechner#typklasse – the
 * browser does this only on a full page load. If the section is not rendered
 * yet (a page loaded later), the page starts at the top and jumps to the
 * section once it appears.
 */
function scrollToSection(id: string): () => void {
  const find = () => document.getElementById(id);
  const target = find();
  if (target) {
    showSection(target);
    return () => undefined;
  }
  focusContent();
  let timeout = 0;
  const observer = new MutationObserver(() => {
    const found = find();
    if (!found) return;
    stop();
    showSection(found);
  });
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timeout);
  };
  timeout = window.setTimeout(stop, 3000);
  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}

/** Scrolls to the top (or the linked section) and moves focus after client-side navigation. */
function NavigationEffects() {
  const { key, pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef<{ pathname: string; search: string; hash: string } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = { pathname, search, hash };
    if (!before) return;
    const samePage = before.pathname === pathname && before.hash === hash;
    // A changed query (e.g. a new search) is handled by the page itself. The same URL again
    // counts only for a link to the current page (replace), not for a resubmitted form (push).
    if (samePage && (before.search !== search || navigationType !== NavigationType.Replace)) {
      return;
    }
    if (hash) {
      // Back/forward and in-page anchors: the browser restores or sets the position itself.
      if (navigationType === NavigationType.Pop) return;
      return scrollToSection(fragmentId(hash));
    }
    focusContent();
    return undefined;
  }, [key, pathname, search, hash, navigationType]);
  return null;
}

function AnalyticsSetup() {
  const config = useConfig();
  const enabled = config.data?.features.analytics;
  useEffect(() => {
    if (enabled !== undefined) configureAnalytics(enabled);
  }, [enabled]);
  return null;
}

export function App({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <NavigationEffects />
        <AnalyticsSetup />
        <Layout>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auto-finden" element={<FindCarPage />} />
              <Route path="/inserat-pruefen" element={<CheckListingPage />} />
              <Route path="/auto-berater" element={<AdvisorPage />} />
              <Route path="/modelle" element={<ModelsPage />} />
              <Route path="/modelle/:id" element={<ModelPage />} />
              <Route path="/gebrauchtwagen-kaufen" element={<BuyingGuidePage />} />
              <Route path="/gebrauchtwagen-checkliste" element={<ChecklistGuidePage />} />
              <Route path="/auto-besichtigung-checkliste" element={<InspectionGuidePage />} />
              <Route path="/kfz-steuer-rechner" element={<TaxGuidePage />} />
              <Route path="/kaufvertrag" element={<SaleContractPage />} />
              <Route path="/auto-verkaufen" element={<SellingGuidePage />} />
              <Route path="/pro" element={<ProPage />} />
              <Route path="/bot" element={<BotPage />} />
              <Route path="/datenschutz" element={<PrivacyPage />} />
              <Route path="/impressum" element={<ImprintPage />} />
              <Route path="/agb" element={<TermsPage />} />
              <Route path="/widerrufsbelehrung" element={<WithdrawalPolicyPage />} />
              <Route path="/vertrag-kuendigen" element={<CancelContractPage />} />
              <Route path="/vertrag-widerrufen" element={<WithdrawContractPage />} />
              <Route path="/pro/bestellen" element={<OrderPage />} />
              <Route path="/pro/bestellt" element={<OrderDonePage />} />
              <Route path="/inseratstext" element={<TextInputPage />} />
              <Route path="/analyse/:id" element={<ResultPage />} />
              <Route path="/meine-angebote" element={<SavedListingsPage />} />
              <Route path="/mein-auto" element={<MyCarPage />} />
              <Route path="/mein-auto/:id/kostenbuch" element={<CarLogPage />} />
              <Route path="/mein-auto/:id/erinnerungen" element={<RemindersPage />} />
              <Route path="/erinnerungen-bestaetigen" element={<ConfirmRemindersPage />} />
              <Route path="/erinnerung-abbestellen" element={<UnsubscribeReminderPage />} />
              <Route path="/vergleich" element={<ComparePage />} />
              <Route path="/verlauf" element={<HistoryPage />} />
              <Route path="/anmelden" element={<LoginPage />} />
              <Route path="/registrieren" element={<RegisterPage />} />
              <Route path="/konto" element={<AccountPage />} />
              <Route path="/passwort-vergessen" element={<ForgotPasswordPage />} />
              <Route path="/passwort-zuruecksetzen" element={<ResetPasswordPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </ToastProvider>
    </QueryClientProvider>
  );
}
