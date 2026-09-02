import { LocationProvider, Route, Router } from 'preact-iso';
import { Header } from './components/Header';
import { AudioAlignmentPage } from './pages/AudioAlignmentPage';
import { SilenceRemoverPage } from './pages/SilenceRemoverPage';
import { BASE_PATH } from './utils/basePath';

export function App() {
  return (
    <LocationProvider>
      <div class="min-h-screen bg-surface-base">
        <Header />
        <Router>
          <Route path={`${BASE_PATH}/`} component={SilenceRemoverPage} />
          <Route path={`${BASE_PATH}/alignment`} component={AudioAlignmentPage} />
        </Router>
      </div>
    </LocationProvider>
  );
}
