import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, RequireAuth } from './components/guards.tsx';
import { AppShell } from './components/AppShell.tsx';
import CreateEvent from './pages/CreateEvent.tsx';
import Dashboard from './pages/Dashboard.tsx';
import EventDetail from './pages/EventDetail.tsx';
import EventsList from './pages/EventsList.tsx';
import FirstPasswordChange from './pages/FirstPasswordChange.tsx';
import Login from './pages/Login.tsx';
import StatusPublic from './pages/StatusPublic.tsx';
import Teams from './pages/Teams.tsx';

function Shell() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/events"
          element={
            <RequireAuth>
              <EventsList />
            </RequireAuth>
          }
        />
        <Route
          path="/events/new"
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
        <Route
          path="/teams"
          element={
            <RequireAuth>
              <Teams />
            </RequireAuth>
          }
        />
        <Route path="*" element={<p className="text-sm text-muted">Not found</p>} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* The one public surface (constitution v1.3.0) — no shell, no auth. */}
        <Route path="/status" element={<StatusPublic />} />
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
          path="*"
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
