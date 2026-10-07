import type { ReactNode } from 'react';

import type { TeamOperationalStatus } from '@smart-factory/types';

/** Shared primitives (spec/004 D25) — one visual identity for every screen. */

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-(--radius-card) border border-line bg-surface shadow-(--shadow-card) ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-b border-line px-5 py-3.5">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className}`} />;
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="m-4 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad"
    >
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 font-medium underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}

export const STATUS_META: Record<
  TeamOperationalStatus,
  { label: string; dot: string; soft: string; text: string }
> = {
  OPERATIONAL: { label: 'Operational', dot: 'bg-ok', soft: 'bg-ok-soft', text: 'text-ok' },
  DEGRADED: { label: 'Degraded', dot: 'bg-warn', soft: 'bg-warn-soft', text: 'text-warn' },
  PARTIAL_OUTAGE: {
    label: 'Partial Outage',
    dot: 'bg-orange-500',
    soft: 'bg-orange-50',
    text: 'text-orange-600',
  },
  MAJOR_OUTAGE: { label: 'Major Outage', dot: 'bg-bad', soft: 'bg-bad-soft', text: 'text-bad' },
};

export function StatusDot({ status }: { status: TeamOperationalStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block size-2.5 rounded-full ${meta.dot}`} />
      <span className={`text-sm font-medium ${meta.text}`}>{meta.label}</span>
    </span>
  );
}

export function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral'; children: ReactNode }) {
  const tones: Record<string, string> = {
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    info: 'bg-brand-soft text-brand',
    neutral: 'bg-line/60 text-muted',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
