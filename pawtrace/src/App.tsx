import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppStore, useAppStore } from './context/AppStore';
import { BottomNav } from './components/BottomNav';
import { Fab } from './components/Fab';
import { Toast } from './components/Toast';
import { PawIcon } from './components/PawPath';
import { HomeFeed } from './screens/HomeFeed';
import { MapScreen } from './screens/MapScreen';
import { SearchScreen } from './screens/SearchScreen';
import { PetDetail } from './screens/PetDetail';
import { ReportLost } from './screens/ReportLost';
import { ReportSighting } from './screens/ReportSighting';
import { Profile } from './screens/Profile';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { Login } from './screens/Login';
import './styles/tokens.css';
import './styles/base.css';

function AppContent() {
  const { toast } = useAppStore();

  return (
    <div className="app-column">
      <Routes>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/pet/:id" element={<PetDetail />} />
        <Route path="/report" element={<ReportLost status="lost" />} />
        <Route path="/report-found" element={<ReportLost status="found" />} />
        <Route path="/edit/:id" element={<ReportLost />} />
        <Route path="/report-sighting/:id?" element={<ReportSighting />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
      <Fab />
      {toast && <Toast message={toast} />}
    </div>
  );
}

function Splash() {
  return (
    <div className="app-column" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="splash-paw" aria-label="Loading PawTrace" role="status">
        <PawIcon size={56} color="var(--sprout-500)" />
      </div>
    </div>
  );
}

function Root() {
  const { loading, user } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Login />;
  return (
    <AppStore>
      <AppContent />
    </AppStore>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  );
}
