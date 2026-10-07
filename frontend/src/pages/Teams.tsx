import { useEffect, useState } from 'react';

import type { TeamDTO } from '@smart-factory/types';

import { api } from '../services/api.ts';
import { Card, EmptyState, ErrorState, PanelHeader, Skeleton } from '../components/ui.tsx';

export default function Teams() {
  const [teams, setTeams] = useState<TeamDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api<TeamDTO[]>('/teams')
      .then(setTeams)
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">
        Maintenance teams &amp; on-call rotation
      </h1>
      {error && <ErrorState message={error} onRetry={load} />}
      {teams === null && !error && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      )}
      {teams?.length === 0 && (
        <Card>
          <EmptyState
            title="No teams configured yet"
            hint="Events will remain unassigned until an Admin creates a team."
          />
        </Card>
      )}
      <div className="space-y-3">
        {teams?.map((team) => (
          <Card key={team.id}>
            <PanelHeader title={team.name} hint={`Rotation: ${team.cadence.toLowerCase()}`} />
            <div className="p-5">
              {team.onDuty && (
                <span className="mb-3 inline-block rounded bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">
                  On duty: {team.onDuty.name}
                </span>
              )}
              <ol className="space-y-1 text-sm">
                {team.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="w-6 text-xs text-muted">#{m.position}</span>
                    <span className={team.onDuty?.id === m.id ? 'font-medium' : ''}>
                      {m.name}
                    </span>
                    {team.onDuty?.id === m.id && (
                      <span className="text-xs text-ok">← on duty</span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">
                Anchor: {new Date(team.anchorAt).toLocaleString()}
                {team.escalationAdmin && (
                  <> · Escalation manager: {team.escalationAdmin.name}</>
                )}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
