import { describe, expect, it } from 'vitest';

import { onDutyIndex } from '../../src/teams/rotation.ts';

const ANCHOR = new Date('2026-10-05T08:00:00Z'); // Monday 08:00 UTC
const WEEK = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

describe('rotation math (SC-102, research D12) — synthetic clock only', () => {
  it('weekly: wraps around correctly across 3 full cycles (position 0,1,2,0,1,2…)', () => {
    const weeks = (n: number) => new Date(ANCHOR.getTime() + n * WEEK + 60_000);
    expect(onDutyIndex('WEEKLY', ANCHOR, weeks(0), 3)).toBe(0);
    expect(onDutyIndex('WEEKLY', ANCHOR, weeks(1), 3)).toBe(1);
    expect(onDutyIndex('WEEKLY', ANCHOR, weeks(2), 3)).toBe(2);
    expect(onDutyIndex('WEEKLY', ANCHOR, weeks(3), 3)).toBe(0);
    expect(onDutyIndex('WEEKLY', ANCHOR, weeks(4), 3)).toBe(1);
    expect(onDutyIndex('WEEKLY', ANCHOR, weeks(5), 3)).toBe(2);
    expect(onDutyIndex('WEEKLY', ANCHOR, weeks(8), 3)).toBe(2);
  });

  it('daily: advances once per 24h', () => {
    expect(onDutyIndex('DAILY', ANCHOR, new Date(ANCHOR.getTime() + 0 * DAY + 60_000), 2)).toBe(0);
    expect(onDutyIndex('DAILY', ANCHOR, new Date(ANCHOR.getTime() + 1 * DAY + 60_000), 2)).toBe(1);
    expect(onDutyIndex('DAILY', ANCHOR, new Date(ANCHOR.getTime() + 2 * DAY + 60_000), 2)).toBe(0);
  });

  it('now before the anchor clamps to position 0', () => {
    expect(onDutyIndex('WEEKLY', ANCHOR, new Date(ANCHOR.getTime() - DAY), 3)).toBe(0);
    expect(onDutyIndex('WEEKLY', ANCHOR, ANCHOR, 3)).toBe(0);
  });

  it('single member is always on duty; empty rotation reports -1', () => {
    expect(onDutyIndex('WEEKLY', ANCHOR, new Date(ANCHOR.getTime() + 5 * WEEK), 1)).toBe(0);
    expect(onDutyIndex('WEEKLY', ANCHOR, new Date(ANCHOR.getTime() + WEEK), 0)).toBe(-1);
  });
});
