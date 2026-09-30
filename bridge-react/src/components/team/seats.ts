// TBP-763 — seat limits on the built-in team page.
//
// Seats are a plan limit the app names (for example `seats`): a gauge Bridge
// counts itself from membership (`source: 'membership'` on the quota snapshot)
// — active members plus pending invites, read fresh. Bridge's invite API does
// not refuse at the limit, so the team page runs the check itself when given
// the limit's name (`seatsMetric`):
//   - Invite is disabled at the plan's limit, with a line saying why;
//   - one invite of several addresses cannot jump past the limit either;
//   - after an invite, removal, or enable/disable the seat quota is re-read,
//     so the page follows the team (a live `quota.updated` push may arrive too).
// Without `seatsMetric` the page is unchanged and reads no quota.

import { useRef, useSyncExternalStore } from 'react';
import { useBridge, type QuotaSnapshot } from '@nebulr-group/bridge-auth-core';
import { logger } from '../../utils/logger';

/**
 * Seats left before the plan's cap, or null when unknown: not loaded yet, no
 * limit on the plan, or a metered limit (extra seats are billed, not refused).
 * The page never guesses — null means "do not gate".
 */
export function seatsLeftOf(snapshot: QuotaSnapshot | undefined): number | null {
  if (!snapshot) return null;
  if (snapshot.policy === 'metered') return null;
  if (typeof snapshot.limit !== 'number' || snapshot.limit < 0) return null;
  if (typeof snapshot.remaining !== 'number') return null;
  return Math.max(0, snapshot.remaining);
}

/**
 * Why an invite of `count` addresses is refused with `remaining` seats left,
 * or null when it fits. `remaining` null = unknown: no refusal.
 */
export function inviteSeatError(count: number, remaining: number | null | undefined): string | null {
  if (remaining === null || remaining === undefined) return null;
  const left = Math.max(0, remaining);
  if (count <= left) return null;
  if (left === 0) return 'All seats on your plan are taken. Upgrade your plan to invite more people.';
  return `Your plan has ${left} ${left === 1 ? 'seat' : 'seats'} left, and this invites ${count}. Invite fewer people or upgrade your plan.`;
}

/**
 * After the team changed: re-read the seat count now, when the page counts
 * seats. Whichever is newer wins if a live push also arrives.
 */
export function seatsChanged(seatsMetric: string | undefined): void {
  if (!seatsMetric) return;
  try {
    useBridge().quotas.reconcileAfterReport(seatsMetric, 0);
  } catch (err) {
    logger.debug('[bridge-team] seat re-read skipped:', err);
  }
}

const noSubscribe = () => () => {};
const noSnapshot = () => undefined;

/**
 * The seat quota snapshot for `seatsMetric`, live. Reads nothing (no request)
 * when `seatsMetric` is not given. The first read hydrates the metric.
 */
export function useSeatsQuota(seatsMetric: string | undefined): QuotaSnapshot | undefined {
  const lastRef = useRef<QuotaSnapshot | undefined>(undefined);
  return useSyncExternalStore(
    seatsMetric
      ? (onChange) =>
          useBridge().quotas.subscribe((m) => {
            if (m === seatsMetric) onChange();
          })
      : noSubscribe,
    seatsMetric
      ? () => {
          let next: QuotaSnapshot | undefined;
          try {
            next = useBridge().quota(seatsMetric);
          } catch {
            next = undefined;
          }
          // Keep the reference stable while nothing that matters moved.
          const prev = lastRef.current;
          if (
            prev &&
            next &&
            prev.used === next.used &&
            prev.limit === next.limit &&
            prev.remaining === next.remaining &&
            prev.policy === next.policy &&
            prev.source === next.source
          ) {
            return prev;
          }
          lastRef.current = next;
          return next;
        }
      : noSnapshot,
    () => lastRef.current,
  );
}
