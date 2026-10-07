import { useEffect, useState } from 'react';

import type { TeamDTO } from '@smart-factory/types';

import { api } from '../services/api.ts';

export default function Teams() {
  const [teams, setTeams] = useState<TeamDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TeamDTO[]>('/teams')
      .then(setTeams)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Maintenance teams &amp; on-call rotation</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {teams === null && !error && <p className="text-slate-500">Loading…</p>}
      {teams?.length === 0 && (
        <p className="rounded border bg-white p-4 text-slate-500">
          No teams configured yet — events will remain unassigned until an Admin creates a
          team.
        </p>
      )}
      <div className="space-y-3">
        {teams?.map((team) => (
          <div key={team.id} className="rounded border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{team.name}</h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                {team.cadence}
              </span>
              {team.onDuty && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  On duty: {team.onDuty.name}
                </span>
              )}
            </div>
            <ol className="mt-2 space-y-1 text-sm">
              {team.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="w-6 text-xs text-slate-400">#{m.position}</span>
                  <span className={team.onDuty?.id === m.id ? 'font-medium' : ''}>
                    {m.name}
                  </span>
                  {team.onDuty?.id === m.id && (
                    <span className="text-xs text-emerald-700">← on duty</span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              Rotation anchor: {new Date(team.anchorAt).toLocaleString()}
              {team.escalationAdmin && <> · Escalation manager: {team.escalationAdmin.name}</>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
