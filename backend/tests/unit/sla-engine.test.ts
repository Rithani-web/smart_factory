import { describe, expect, it } from 'vitest';

import { evaluateSla } from '../../src/sla/engine.ts';

// Injected clock (FR-208): every scenario runs on synthetic timestamps —
// zero real waiting. CRITICAL defaults: ack 5 min, resolve 60 min.
const TARGETS = { ackMinutes: 5, resolveMinutes: 60 };
const REPORTED = new Date('2026-10-07T10:00:00Z');
const min = (n: number, sec = 0) => new Date(REPORTED.getTime() + n * 60_000 + sec * 1000);

function eval_(overrides: {
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  now: Date;
  targets?: { ackMinutes: number; resolveMinutes: number };
}) {
  return evaluateSla(
    {
      createdAt: REPORTED,
      acknowledgedAt: overrides.acknowledgedAt ?? null,
      resolvedAt: overrides.resolvedAt ?? null,
    },
    overrides.targets ?? TARGETS,
    overrides.now,
  );
}

describe('US2/US3 SLA engine (FR-208) — mocked time only', () => {
  it('1. acknowledged WITHIN the SLA → MET with actual (US2-1)', () => {
    const sla = eval_({ acknowledgedAt: min(3), now: min(4) });
    expect(sla.acknowledge).toEqual({ targetMinutes: 5, actualMinutes: 3, status: 'MET' });
  });

  it('2. acknowledged AFTER the SLA → BREACHED with actual (US2-2)', () => {
    const sla = eval_({ acknowledgedAt: min(6), now: min(7) });
    expect(sla.acknowledge.status).toBe('BREACHED');
    expect(sla.acknowledge.actualMinutes).toBeCloseTo(6, 5);
  });

  it('3. resolved WITHIN the SLA → MET (US2-3)', () => {
    const sla = eval_({ resolvedAt: min(50), now: min(51) });
    expect(sla.resolve).toEqual({ targetMinutes: 60, actualMinutes: 50, status: 'MET' });
  });

  it('4. resolved AFTER the SLA → BREACHED (US2-4)', () => {
    const sla = eval_({ resolvedAt: min(90), now: min(91) });
    expect(sla.resolve.status).toBe('BREACHED');
    expect(sla.resolve.actualMinutes).toBeCloseTo(90, 5);
  });

  it('5. still-open event past the acknowledge target → BREACHED without ack (US2-5, FR-206)', () => {
    const sla = eval_({ now: min(7) });
    expect(sla.acknowledge.status).toBe('BREACHED');
    expect(sla.acknowledge.actualMinutes).toBeCloseTo(7, 5);
    expect(sla.resolve.status).toBe('PENDING'); // resolve target not yet due
  });

  it('6. still-open event past the resolve target → resolve BREACHED (US2-6, FR-206)', () => {
    const sla = eval_({ now: min(24 * 60 + 1) }); // > 1 day open
    expect(sla.resolve.status).toBe('BREACHED');
    expect(sla.acknowledge.status).toBe('BREACHED'); // ack long past due too
  });

  it('boundary: elapsed exactly at the target counts as MET (US3-2)', () => {
    const sla = eval_({ acknowledgedAt: min(5), now: min(6) });
    expect(sla.acknowledge.status).toBe('MET');
  });

  it('boundary: one second past the target is BREACHED (US3-3)', () => {
    const sla = eval_({ acknowledgedAt: min(5, 1), now: min(6) });
    expect(sla.acknowledge.status).toBe('BREACHED');
  });

  it('not yet due and not done → PENDING (neutral)', () => {
    const sla = eval_({ now: min(2) });
    expect(sla.acknowledge.status).toBe('PENDING');
    expect(sla.resolve.status).toBe('PENDING');
  });

  it('never acknowledged but resolved: ack dimension evaluates against now', () => {
    const sla = eval_({ resolvedAt: min(30), now: min(31) });
    expect(sla.acknowledge.status).toBe('BREACHED'); // 31 min open, 5 min target
    expect(sla.resolve.status).toBe('MET');
  });

  it('deterministic: same inputs and now → same result (SC-204)', () => {
    const a = eval_({ acknowledgedAt: min(3), resolvedAt: min(45), now: min(50) });
    const b = eval_({ acknowledgedAt: min(3), resolvedAt: min(45), now: min(50) });
    expect(a).toEqual(b);
  });
});
