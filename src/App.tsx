import { useMemo } from 'react';
import { ToastProvider } from './components/ui';
import { PreferencesRepository } from './data/preferencesRepo';
import { ContributionForm } from './pages/ContributionForm';
import { ExpenseForm } from './pages/ExpenseForm';
import { Favorites } from './pages/Favorites';
import { Formula } from './pages/Formula';
import { TripDetail } from './pages/TripDetail';
import { TripForm } from './pages/TripForm';
import { TripList } from './pages/TripList';
import { useRoute } from './router';
import { AppStoreProvider } from './store/AppStore';

function Screen() {
  const r = useRoute();
  switch (r.name) {
    case 'trips':
      return <TripList />;
    case 'favorites':
      return <Favorites />;
    case 'tripNew':
      return <TripForm key="new" />;
    case 'tripEdit':
      return <TripForm key={r.tripId} tripId={r.tripId} />;
    case 'trip':
      return <TripDetail tripId={r.tripId} tab={r.tab} />;
    case 'expenseNew':
      return <ExpenseForm tripId={r.tripId} />;
    case 'expenseEdit':
      return <ExpenseForm tripId={r.tripId} expenseId={r.expenseId} />;
    case 'contributionNew':
      return <ContributionForm tripId={r.tripId} />;
    case 'formula':
      return <Formula tripId={r.tripId} />;
  }
}

export default function App() {
  const repo = useMemo(() => new PreferencesRepository(), []);
  return (
    <AppStoreProvider repo={repo}>
      <ToastProvider>
        <Screen />
      </ToastProvider>
    </AppStoreProvider>
  );
}
