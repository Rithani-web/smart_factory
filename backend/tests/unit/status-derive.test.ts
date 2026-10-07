import { describe, expect, it } from 'vitest';

import { deriveTeamStatus } from '../../src/status/derive.ts';

describe('derived team status matrix (FR-304, D21)', () => {
  it('no open events → OPERATIONAL', () => {
    expect(deriveTeamStatus([])).toBe('OPERATIONAL');
  });

  it('LOW or MEDIUM open → DEGRADED', () => {
    expect(deriveTeamStatus(['LOW'])).toBe('DEGRADED');
    expect(deriveTeamStatus(['MEDIUM'])).toBe('DEGRADED');
    expect(deriveTeamStatus(['LOW', 'LOW'])).toBe('DEGRADED');
  });

  it('any HIGH open → PARTIAL_OUTAGE', () => {
    expect(deriveTeamStatus(['HIGH'])).toBe('PARTIAL_OUTAGE');
    expect(deriveTeamStatus(['LOW', 'HIGH'])).toBe('PARTIAL_OUTAGE');
  });

  it('any CRITICAL open → MAJOR_OUTAGE (highest wins; two criticals still one status)', () => {
    expect(deriveTeamStatus(['CRITICAL'])).toBe('MAJOR_OUTAGE');
    expect(deriveTeamStatus(['CRITICAL', 'CRITICAL'])).toBe('MAJOR_OUTAGE');
    expect(deriveTeamStatus(['LOW', 'HIGH', 'CRITICAL'])).toBe('MAJOR_OUTAGE');
  });
});
