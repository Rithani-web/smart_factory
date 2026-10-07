import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { SEVERITIES } from '@smart-factory/types';

import { ApiError } from '../services/api.ts';
import { createEvent } from '../services/events.ts';

export default function CreateEvent() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [machineRef, setMachineRef] = useState('');
  const [severity, setSeverity] = useState<string>('MEDIUM');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { event } = await createEvent({ title, description, machineRef, severity });
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the event');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-lg font-semibold">Report a production event</h1>
      <form onSubmit={onSubmit} className="space-y-3 rounded border bg-white p-4 shadow-sm">
        <label className="block text-sm">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Packaging line 2 jammer fault"
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="block text-sm">
          Machine / line
          <input
            required
            value={machineRef}
            onChange={(e) => setMachineRef(e.target.value)}
            placeholder="e.g. Line 2"
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="block text-sm">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1.5"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Description
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, what is affected?"
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-800 px-4 py-1.5 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Reporting…' : 'Report event'}
        </button>
      </form>
    </div>
  );
}
