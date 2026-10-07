import type { RotationCadence } from '@smart-factory/types';

const PERIOD_MS: Record<RotationCadence, number> = {
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
};

/**
 * Pure rotation math (research D12, FR-103): which position of an ordered
 * rotation is on duty at `now`. Elapsed periods since the anchor, wrapping.
 * `now` before the anchor clamps to position 0. Injected clock in tests —
 * no real time is read here.
 */
export function onDutyIndex(
  cadence: RotationCadence,
  anchorAt: Date,
  now: Date,
  memberCount: number,
): number {
  if (memberCount <= 0) {
    return -1;
  }
  const elapsed = now.getTime() - anchorAt.getTime();
  if (elapsed <= 0) {
    return 0;
  }
  return Math.floor(elapsed / PERIOD_MS[cadence]) % memberCount;
}
