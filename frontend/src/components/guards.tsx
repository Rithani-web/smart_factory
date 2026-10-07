/* Client-side guards are UX ONLY — the server enforces every permission
 * (Constitution II). */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import type { Role, SessionUserDTO } from '@smart-factory/types';

import * as authApi from '../services/auth.ts';

interface AuthState {
  user: SessionUserDTO | null;
  loading: boolean;
  setUser: (u: SessionUserDTO | null) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // FR-019: nothing else until the first password change is done.
  if (user.mustChangePassword && location.pathname !== '/first-password') {
    return <Navigate to="/first-password" replace />;
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
        You do not have permission to do that.
      </p>
    );
  }
  return <>{children}</>;
}
