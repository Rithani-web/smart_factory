import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { EventDetailDTO, UserDTO } from '@smart-factory/types';

import { ApiError } from '../services/api.ts';
import { acknowledgeEvent, getEvent, listUsers, reassignEvent, resolveEvent } from '../services/events.ts';
import { useAuth } from '../components/guards.tsx';
import { SeverityBadge, StatusBadge } from '../components/badges.tsx';

export default function EventDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isAssignee = !!user && event?.assignee?.id === user.id;

  const load = useCallback(() => {
    getEvent(id)
      .then(setEvent)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (error && !event) return <p className="text-sm text-red-600">{error}</p>;
  if (!event) return <p className="text-slate-500">Loading…</p>;

  const canAcknowledge = event.status === 'ASSIGNED' && (isAssignee || isAdmin);
  const canResolve =
    event.status !== 'RESOLVED' && (isAdmin || (isAssignee && event.status === 'ACKNOWLEDGED'));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/" className="text-sm text-slate-500 hover:underline">
        ← All events
      </Link>
      <div className="rounded border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{event.title}</h1>
          <SeverityBadge severity={event.severity} />
          <StatusBadge status={event.status} />
          {event.unassigned && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Unassigned — nobody on duty
            </span>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Machine / line</dt>
          <dd>{event.machineRef}</dd>
          <dt className="text-slate-500">Reported by</dt>
          <dd>
            {event.reporter.name} ({event.reporter.role})
          </dd>
          <dt className="text-slate-500">Assigned technician</dt>
          <dd>{event.assignee ? `${event.assignee.name} (${event.assignee.role})` : '—'}</dd>
          <dt className="text-slate-500">Reported</dt>
          <dd>{new Date(event.createdAt).toLocaleString()}</dd>
          {event.acknowledgedAt && (
            <>
              <dt className="text-slate-500">Acknowledged</dt>
              <dd>{new Date(event.acknowledgedAt).toLocaleString()}</dd>
            </>
          )}
          {event.resolvedAt && (
            <>
              <dt className="text-slate-500">Resolved</dt>
              <dd>{new Date(event.resolvedAt).toLocaleString()}</dd>
            </>
          )}
        </dl>
        <p className="mt-3 whitespace-pre-wrap text-sm">{event.description}</p>
        {event.resolutionNotes && (
          <p className="mt-2 rounded bg-emerald-50 p-2 text-sm text-emerald-800">
            <strong>Resolution:</strong> {event.resolutionNotes}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {(canAcknowledge || canResolve || isAdmin) && (
        <Actions
          event={event}
          canAcknowledge={canAcknowledge}
          canResolve={canResolve}
          isAdmin={isAdmin}
          busy={busy}
          notes={notes}
          setNotes={setNotes}
          onAcknowledge={() => act(() => acknowledgeEvent(event.id))}
          onResolve={() => act(() => resolveEvent(event.id, notes))}
          onReassign={(technicianId) => act(() => reassignEvent(event.id, technicianId))}
        />
      )}

      <div className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Lifecycle history</h2>
        <ol className="space-y-2">
          {event.history.map((h) => (
            <li key={h.id} className="flex items-center gap-2 text-sm">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                {h.action}
              </span>
              <span>
                {h.actor.name} ({h.actor.role})
              </span>
              {h.detail && <span className="text-slate-500">— {h.detail}</span>}
              <span className="ml-auto text-xs text-slate-400">
                {new Date(h.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Actions(props: {
  event: EventDetailDTO;
  canAcknowledge: boolean;
  canResolve: boolean;
  isAdmin: boolean;
  busy: boolean;
  notes: string;
  setNotes: (v: string) => void;
  onAcknowledge: () => void;
  onResolve: () => void;
  onReassign: (technicianId: string) => void;
}) {
  const { event, canAcknowledge, canResolve, isAdmin, busy, notes, setNotes, onAcknowledge, onResolve, onReassign } = props;
  const [techs, setTechs] = useState<UserDTO[]>([]);
  const [showReassign, setShowReassign] = useState(false);

  useEffect(() => {
    if (showReassign && techs.length === 0) {
      listUsers()
        .then((all) => setTechs(all.filter((u) => u.role === 'TECHNICIAN')))
        .catch(() => setTechs([]));
    }
  }, [showReassign, techs.length]);

  return (
    <div className="space-y-3 rounded border bg-white p-4 shadow-sm">
      {canAcknowledge && (
        <button
          onClick={onAcknowledge}
          disabled={busy}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Acknowledge
        </button>
      )}
      {canResolve && (
        <div className="space-y-2">
          <label className="block text-sm">
            Resolution notes (required)
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5"
              placeholder="What was done to fix it?"
            />
          </label>
          <button
            onClick={onResolve}
            disabled={busy || !notes.trim()}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Resolve
          </button>
        </div>
      )}
      {isAdmin && event.status !== 'RESOLVED' && (
        <div>
          {showReassign ? (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onReassign(e.target.value);
                  setShowReassign(false);
                }
              }}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                Select technician…
              </option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setShowReassign(true)}
              disabled={busy}
              className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Reassign…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
