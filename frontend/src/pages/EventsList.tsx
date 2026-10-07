import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { EventDTO } from '@smart-factory/types';

import { listEvents } from '../services/events.ts';
import { SeverityBadge, StatusBadge } from '../components/badges.tsx';
import { Card, EmptyState, ErrorState, Skeleton } from '../components/ui.tsx';

export default function EventsList() {
  const [events, setEvents] = useState<EventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listEvents()
      .then(setEvents)
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Production events</h1>
        <Link
          to="/events/new"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-strong"
        >
          Report event
        </Link>
      </div>
      {error && <ErrorState message={error} onRetry={load} />}
      {!events && !error && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}
      {events?.length === 0 && (
        <Card>
          <EmptyState
            title="No production events yet"
            hint="Report the first event to see it here."
          />
        </Card>
      )}
      <ul className="space-y-2">
        {events?.map((e) => (
          <li key={e.id}>
            <Link
              to={`/events/${e.id}`}
              className="block rounded-xl border border-line bg-surface p-4 shadow-(--shadow-card) transition-colors hover:border-brand/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.title}</span>
                <SeverityBadge severity={e.severity} />
                <StatusBadge status={e.status} />
                {e.unassigned && (
                  <span className="rounded bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
                    Unassigned
                  </span>
                )}
                {e.slaBreached && (
                  <span className="rounded bg-bad-soft px-2 py-0.5 text-xs font-medium text-bad">
                    SLA ⚠
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted">
                {e.machineRef} · reported {new Date(e.createdAt).toLocaleString()}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
