import type { EventStatus, Severity } from '@smart-factory/types';

const severityStyles: Record<Severity, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-sky-100 text-sky-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const statusStyles: Record<EventStatus, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  ACKNOWLEDGED: 'bg-indigo-100 text-indigo-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${severityStyles[severity]}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
