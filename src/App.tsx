import { lazy, Suspense, useEffect } from 'react';
import { Spinner } from './components/ui';
import { useRoute } from './lib/router';
import { useToast } from './lib/toast';
import HomeScreen from './screens/HomeScreen';
import Onboarding from './screens/Onboarding';
import { useSettings } from './settings';

// Everything except Coming Up (and first-run onboarding) is code-split.
const ScanScreen = lazy(() => import('./screens/ScanScreen'));
const ReviewScreen = lazy(() => import('./screens/ReviewScreen'));
const CardScreen = lazy(() => import('./screens/CardScreen'));
const EditScreen = lazy(() => import('./screens/EditScreen'));
const WalletScreen = lazy(() => import('./screens/WalletScreen'));
const ReceiptsScreen = lazy(() => import('./screens/ReceiptsScreen'));
const SavingsScreen = lazy(() => import('./screens/SavingsScreen'));
const CheckinScreen = lazy(() => import('./screens/CheckinScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const PrivacyScreen = lazy(() => import('./screens/PrivacyScreen'));
const CreditsScreen = lazy(() => import('./screens/CreditsScreen'));

function Toast() {
  const t = useToast();
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+110px)] z-[60] flex justify-center px-6">
      {t.message && (
        <span key={t.id} className="rounded-full bg-paper px-4 py-2 text-center text-[14px] font-medium text-ink shadow-xl motion-safe:animate-[fadein_150ms_ease-out]">
          {t.message}
        </span>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="h-screen-safe flex items-center justify-center bg-ink">
      <Spinner label="Loading" />
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const settings = useSettings();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  let screen;
  if (!settings.onboarded && route.name !== 'privacy' && route.name !== 'credits') {
    screen = <Onboarding />;
  } else {
    switch (route.name) {
      case 'scan':
        screen = <ScanScreen />;
        break;
      case 'review':
        screen = <ReviewScreen />;
        break;
      case 'card':
        screen = <CardScreen key={route.id} id={route.id} />;
        break;
      case 'edit':
        screen = <EditScreen key={route.id} id={route.id} />;
        break;
      case 'wallet':
        screen = <WalletScreen />;
        break;
      case 'receipts':
        screen = <ReceiptsScreen />;
        break;
      case 'savings':
        screen = <SavingsScreen />;
        break;
      case 'checkin':
        screen = <CheckinScreen />;
        break;
      case 'settings':
        screen = <SettingsScreen />;
        break;
      case 'privacy':
        screen = <PrivacyScreen />;
        break;
      case 'credits':
        screen = <CreditsScreen />;
        break;
      default:
        screen = <HomeScreen />;
    }
  }

  return (
    <>
      <Suspense fallback={<Loading />}>{screen}</Suspense>
      <Toast />
    </>
  );
}
