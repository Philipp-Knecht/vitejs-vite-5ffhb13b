import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { useConfig } from './api/queries';
import { Layout } from './components/layout/Layout';
import { PageLoading } from './components/ui/Spinner';
import { ToastProvider } from './components/ui/ToastProvider';
import { configureAnalytics } from './lib/analytics';
import { BuyingGuidePage } from './pages/guides/BuyingGuidePage';
import { ChecklistGuidePage } from './pages/guides/ChecklistGuidePage';
import { InspectionGuidePage } from './pages/guides/InspectionGuidePage';
import { CheckListingPage } from './pages/CheckListingPage';
import { FindCarPage } from './pages/FindCarPage';
import { LandingPage } from './pages/LandingPage';
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

/** Scrolls to the top and moves focus to the content after client-side navigation. */
function NavigationEffects() {
  const { pathname, hash } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (hash) return;
    window.scrollTo(0, 0);
    document.getElementById('inhalt')?.focus({ preventScroll: true });
  }, [pathname, hash]);
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
              <Route path="/gebrauchtwagen-kaufen" element={<BuyingGuidePage />} />
              <Route path="/gebrauchtwagen-checkliste" element={<ChecklistGuidePage />} />
              <Route path="/auto-besichtigung-checkliste" element={<InspectionGuidePage />} />
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
