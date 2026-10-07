import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { EventDTO } from '@smart-factory/types';

import { listEvents } from '../services/events.ts';
import { SeverityBadge, StatusBadge } from '../components/badges.tsx';

export default function EventsList() {
  const [events, setEvents] = useState<EventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEvents()
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Production events</h1>
        <Link
          to="/new"
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
        >
          Report event
        </Link>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {events === null && !error && <p className="text-slate-500">Loading…</p>}
      {events?.length === 0 && (
        <p className="rounded border bg-white p-4 text-slate-500">
          No production events yet. Report the first one.
        </p>
      )}
      <ul className="space-y-2">
        {events?.map((e) => (
          <li key={e.id}>
            <Link
              to={`/events/${e.id}`}
              className="block rounded border bg-white p-3 shadow-sm hover:border-slate-400"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.title}</span>
                <SeverityBadge severity={e.severity} />
                <StatusBadge status={e.status} />
                {e.unassigned && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Unassigned
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {e.machineRef} · reported {new Date(e.createdAt).toLocaleString()}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
