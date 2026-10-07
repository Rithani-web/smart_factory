import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../services/api.ts';
import { completePasswordChange } from '../services/auth.ts';
import { useAuth } from '../components/guards.tsx';

export default function FirstPasswordChange() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user: updated } = await completePasswordChange(newPassword);
      setUser(updated);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Password change failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">Set your new password</h1>
      <p className="mb-4 text-sm text-slate-500">
        Welcome, {user?.name}. For security you must choose your own password before
        continuing.
      </p>
      <form onSubmit={onSubmit} className="space-y-3 rounded border bg-white p-4 shadow-sm">
        <label className="block text-sm">
          New password (min 8 characters)
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="block text-sm">
          Confirm new password
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-slate-800 py-1.5 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </div>
  );
}
