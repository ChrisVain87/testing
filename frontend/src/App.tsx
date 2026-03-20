import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { api } from './services/api';
import { LandingPage } from './components/layout/LandingPage';
import { AuthPage } from './components/layout/AuthPage';
import { GamePage } from './components/layout/GamePage';
import { CreateCreaturePage } from './components/layout/CreateCreaturePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full bg-game-dark">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-float">🌍</div>
        <p className="text-gray-400 font-ui text-sm">Loading Creature World...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { tokens, setUser, setTokens } = useAuthStore();

  useEffect(() => {
    // On mount, try to restore session
    if (tokens?.accessToken) {
      api.getMe()
        .then(({ data }) => setUser(data))
        .catch(() => {
          setTokens(null);
          setUser(null);
        });
    } else {
      setUser(null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/create"
        element={
          <ProtectedRoute>
            <CreateCreaturePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
