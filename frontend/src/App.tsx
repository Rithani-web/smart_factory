import { Link, Route, Routes, useNavigate } from 'react-router-dom';

import { AuthProvider, RequireAuth, useAuth } from './components/guards.tsx';
import CreateEvent from './pages/CreateEvent.tsx';
import EventDetail from './pages/EventDetail.tsx';
import EventsList from './pages/EventsList.tsx';
import FirstPasswordChange from './pages/FirstPasswordChange.tsx';
import Login from './pages/Login.tsx';
import Teams from './pages/Teams.tsx';

function Shell() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    const { logout } = await import('./services/auth.ts');
    await logout();
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Link to="/" className="font-semibold">
            Smart Factory
          </Link>
          <span className="text-sm text-slate-400">Production Automation</span>
          {user && (
            <Link to="/teams" className="text-sm hover:underline">
              Teams
            </Link>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-slate-500">
                  {user.name} · {user.role}
                </span>
                <button onClick={signOut} className="hover:underline">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="hover:underline">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/first-password"
            element={
              <RequireAuth>
                <FirstPasswordChange />
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              <RequireAuth>
                <EventsList />
              </RequireAuth>
            }
          />
          <Route
            path="/teams"
            element={
              <RequireAuth>
                <Teams />
              </RequireAuth>
            }
          />
          <Route
            path="/new"
            element={
              <RequireAuth>
                <CreateEvent />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:id"
            element={
              <RequireAuth>
                <EventDetail />
              </RequireAuth>
            }
          />
          <Route path="*" element={<p>Not found</p>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
