import { useEffect, useState } from 'react';

import type { PublicStatusDTO, TeamOperationalStatus } from '@smart-factory/types';

import { publicStatus } from '../services/dashboard.ts';
import { EmptyState, ErrorState, STATUS_META, Skeleton, StatusDot } from '../components/ui.tsx';

/** Public Factory Status Page (US2, FR-307): unauthenticated, Statuspage-style. */
export default function StatusPublic() {
  const [data, setData] = useState<PublicStatusDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    publicStatus()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const overall: TeamOperationalStatus | null = data
    ? data.teams.reduce<TeamOperationalStatus>(
        (worst, t) => {
          const rank: Record<TeamOperationalStatus, number> = {
            OPERATIONAL: 0,
            DEGRADED: 1,
            PARTIAL_OUTAGE: 2,
            MAJOR_OUTAGE: 3,
          };
          return rank[t.finalStatus] > rank[worst] ? t.finalStatus : worst;
        },
        'OPERATIONAL',
      )
    : null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-base font-semibold tracking-tight">Smart Factory</p>
            <p className="text-xs text-muted">Public production status</p>
          </div>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            No sign-in required
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 md:px-6">
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        )}
        {error && <ErrorState message={`Status unavailable: ${error}`} onRetry={load} />}

        {data && overall && (
          <>
            <section
              className={`rounded-xl border p-5 ${STATUS_META[overall].soft} border-line`}
            >
              <div className="flex items-center gap-3">
                <span className={`inline-block size-3 rounded-full ${STATUS_META[overall].dot}`} />
                <div>
                  <h1 className="text-lg font-semibold">
                    {data.teams.every((t) => t.finalStatus === 'OPERATIONAL')
                      ? 'All systems operational'
                      : `Active production disruptions — ${STATUS_META[overall].label}`}
                  </h1>
                  <p className="text-xs text-muted">
                    Updated {new Date(data.serverTime).toLocaleString()} · auto-derived from
                    open production events
                  </p>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">
                Production & maintenance teams
              </h2>
              {data.teams.length === 0 ? (
                <EmptyState title="No teams published yet" />
              ) : (
                <ul className="divide-y divide-line">
                  {data.teams.map((t) => {
                    const openTotal =
                      t.openCounts.CRITICAL +
                      t.openCounts.HIGH +
                      t.openCounts.MEDIUM +
                      t.openCounts.LOW;
                    return (
                      <li key={t.teamId} className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusDot status={t.finalStatus} />
                          <span className="text-xs text-muted">
                            {openTotal} open event{openTotal === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{t.teamName}</p>
                        {t.manualOverride && (
                          <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
                            <strong className="font-semibold">Manual override · </strong>
                            {t.manualOverride.message}
                            <span className="ml-1 opacity-70">
                              — {t.manualOverride.authorName},{' '}
                              {new Date(t.manualOverride.createdAt).toLocaleString()}
                            </span>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="text-center text-xs text-muted">
              Statuses are derived automatically from open production events. Messages
              marked “Manual override” are posted by plant management.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
