import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  DashboardPeriodDays,
  DashboardSummaryDTO,
  Severity,
} from '@smart-factory/types';

import { ApiError } from '../services/api.ts';
import { dashboardSummary } from '../services/dashboard.ts';
import { Card, EmptyState, ErrorState, PanelHeader, Skeleton } from '../components/ui.tsx';
import { useAuth } from '../components/guards.tsx';

const SEVERITY_META: { key: Severity; label: string; tone: string; soft: string }[] = [
  { key: 'CRITICAL', label: 'Critical', tone: 'text-bad', soft: 'bg-bad-soft' },
  { key: 'HIGH', label: 'High', tone: 'text-orange-600', soft: 'bg-orange-50' },
  { key: 'MEDIUM', label: 'Medium', tone: 'text-warn', soft: 'bg-warn-soft' },
  { key: 'LOW', label: 'Low', tone: 'text-ok', soft: 'bg-ok-soft' },
];

const PERIODS: DashboardPeriodDays[] = [7, 30, 90];

export default function Dashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState<DashboardPeriodDays>(7);
  const [teamId, setTeamId] = useState<string>('');
  const [data, setData] = useState<DashboardSummaryDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (d: DashboardPeriodDays, t: string) => {
      setLoading(true);
      setError(null);
      try {
        setData(await dashboardSummary(d, t || undefined));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Dashboard unavailable');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(days, teamId);
  }, [load, days, teamId]);

  const onFilterChange = (d: DashboardPeriodDays, t: string) => {
    setDays(d);
    setTeamId(t);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Operations dashboard</h1>
          <p className="text-sm text-muted">
            Live production health across your maintenance teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={teamId}
            onChange={(e) => onFilterChange(days, e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            aria-label="Team filter"
          >
            <option value="">
              {user?.role === 'ADMIN' ? 'All teams' : 'My team'}
            </option>
            {data?.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => onFilterChange(p, teamId)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  days === p ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => void load(days, teamId)} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading || !data
          ? SEVERITY_META.map((s) => (
              <Card key={s.key} className="p-5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-3 h-8 w-12" />
              </Card>
            ))
          : SEVERITY_META.map((s) => (
              <Card key={s.key} className="p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {s.label} open
                </p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${s.tone}`}>
                  {data.openBySeverity[s.key]}
                </p>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <PanelHeader
            title="Production event volume"
            hint={`Events reported per day · last ${days} days`}
          />
          <div className="h-64 p-4">
            {loading || !data ? (
              <Skeleton className="h-full w-full" />
            ) : data.volume.every((v) => v.count === 0) ? (
              <EmptyState title="No events in this period" hint="Report an event to see the trend" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.volume} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2456e6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2456e6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(5)}
                    tick={{ fontSize: 11, fill: '#5b6b7f' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#5b6b7f' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Events"
                    stroke="#2456e6"
                    strokeWidth={2}
                    fill="url(#vol)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <PanelHeader title="SLA compliance" hint={`Events created in the last ${days} days`} />
          <div className="p-5">
            {loading || !data ? (
              <Skeleton className="h-20 w-full" />
            ) : data.sla.rate === null ? (
              <EmptyState title="No SLA data yet" hint="Nothing fell due in this period" />
            ) : (
              <>
                <p className="text-4xl font-semibold tabular-nums text-brand">
                  {Math.round(data.sla.rate * 100)}%
                </p>
                <p className="mt-1 text-sm text-muted">
                  {data.sla.met} of {data.sla.total} due events met both SLA targets
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round(data.sla.rate * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <PanelHeader title="On-call now" hint="Rotation-computed per team" />
        {loading || !data ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : data.teams.length === 0 ? (
          <EmptyState title="No teams configured" hint="Admins can create teams under Teams" />
        ) : (
          <ul className="divide-y divide-line">
            {data.teams.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted">
                  On call:{' '}
                  <span className="font-medium text-ink">{t.onDutyName ?? '— nobody —'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
