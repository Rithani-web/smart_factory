import { NavLink, Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from './guards.tsx';

const navItem = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-white/10 text-white' : 'text-shell-ink/70 hover:bg-white/5 hover:text-white'
  }`;

/** Application shell (FR-308): dark sidebar on desktop, top bar on tablet. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    const { logout } = await import('../services/auth.ts');
    await logout();
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-shell px-4 py-6 md:flex">
        <Link to="/dashboard" className="mb-8 px-3">
          <p className="text-base font-semibold text-white">Smart Factory</p>
          <p className="text-xs text-shell-ink/60">Production Automation</p>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          <NavLink to="/dashboard" className={navItem}>
            Dashboard
          </NavLink>
          <NavLink to="/events" className={navItem}>
            Events
          </NavLink>
          <NavLink to="/teams" className={navItem}>
            Teams
          </NavLink>
        </nav>
        <div className="border-t border-white/10 px-3 pt-4 text-xs text-shell-ink/60">
          <p className="mb-2 font-medium text-shell-ink">{user?.name}</p>
          <p className="mb-3">{user?.role}</p>
          <button onClick={signOut} className="hover:text-white hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
          <Link to="/dashboard" className="font-semibold md:hidden">
            Smart Factory
          </Link>
          <nav className="flex items-center gap-4 text-sm md:hidden">
            <NavLink to="/dashboard" className="hover:underline">
              Dashboard
            </NavLink>
            <NavLink to="/events" className="hover:underline">
              Events
            </NavLink>
            <NavLink to="/teams" className="hover:underline">
              Teams
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link to="/status" className="text-muted hover:text-brand hover:underline">
              Public status ↗
            </Link>
            {user && (
              <button onClick={signOut} className="hidden text-muted hover:text-ink md:block">
                Sign out ({user.role})
              </button>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
