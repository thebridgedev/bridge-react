/**
 * TBP-763 — seat limits on the built-in team page.
 *
 * Seats are a plan limit the app names (e.g. `seats`), a gauge Bridge counts
 * from membership (`source: 'membership'`: active members plus pending
 * invites). Bridge's invite API does not refuse at the limit, so a plan with 2
 * seats could get a third member through the team page. With `seatsMetric`
 * the page stops Add Member at the limit with a line saying why, refuses an
 * invite of more addresses than seats left, and re-reads the count after a
 * team change. Without it, the page is unchanged and reads no quota.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { useBridge } from '@nebulr-group/bridge-auth-core';
import { TeamUserList } from '../src/components/team/TeamUserList';
import { TeamManagementPanel } from '../src/components/team/TeamManagementPanel';
import { inviteSeatError, seatsLeftOf } from '../src/components/team/seats';
import { _resetBridgeInstance, getBridgeAuth, initBridge } from '../src/core/bridge-instance';

const API = 'http://api.test.local';
const USERS = [
  { id: 'u1', email: 'owner@example.com', role: 'OWNER', enabled: true },
  { id: 'u2', email: 'dev@example.com', role: 'ADMIN', enabled: true },
];

function seats(used: number, limit: number, extra: Record<string, unknown> = {}) {
  return { metric: 'seats', used, limit, remaining: limit - used, policy: 'hard', kind: 'gauge', source: 'membership', ...extra };
}

let created: string[][];
let reReads: Array<[string, number | undefined]>;
let originalFetch: typeof fetch;
const spies: Array<{ mockRestore(): void }> = [];

beforeEach(() => {
  _resetBridgeInstance();
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  useBridge().quotas.__resetForTests();
  created = [];
  reReads = [];
  originalFetch = globalThis.fetch;
  // No quota answer from the network: the tests seed the store directly.
  globalThis.fetch = (async () => new Response('null', { status: 404 })) as unknown as typeof fetch;

  const team = getBridgeAuth().team;
  const quotas = useBridge().quotas;
  spies.push(
    spyOn(team, 'listUsers').mockImplementation((async () => ({ users: USERS, mfaEnabled: false })) as never),
    spyOn(team, 'listUserRoles').mockImplementation((async () => ['OWNER', 'ADMIN']) as never),
    spyOn(team, 'createUsers').mockImplementation((async (emails: string[]) => {
      created.push(emails);
      return emails.map((email, i) => ({ id: `new-${i}`, email, role: 'USER', enabled: true }));
    }) as never),
    spyOn(team, 'deleteUser').mockImplementation((async () => true) as never),
    spyOn(quotas, 'reconcileAfterReport').mockImplementation(((metric: string, delay?: number) => {
      reReads.push([metric, delay]);
    }) as never),
  );
});

afterEach(() => {
  cleanup();
  for (const spy of spies.splice(0)) spy.mockRestore();
  globalThis.fetch = originalFetch;
  useBridge().quotas.__resetForTests();
  _resetBridgeInstance();
});

async function loaded(container: HTMLElement): Promise<void> {
  await waitFor(() => expect(container.querySelector('.bridge-team-table')).not.toBeNull());
}
const addButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Add Member') as HTMLButtonElement;

describe('the team page with seatsMetric (TBP-763)', () => {
  it('2 of 2 seats: Add Member is disabled and the line says why, with the upgrade link', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 2) as never);
    const { container } = render(<TeamUserList seatsMetric="seats" />);
    await loaded(container);

    expect(addButton(container).disabled).toBe(true);
    const line = container.querySelector('[data-bridge-seats-full="seats"]');
    expect(line?.textContent).toContain('All 2 seats on your plan are taken (pending invites count)');
    expect(line?.querySelector('a')?.getAttribute('href')).toBe('/billing');
  });

  it('a live seat count that frees a seat enables Add Member again', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 2) as never);
    const { container } = render(<TeamUserList seatsMetric="seats" />);
    await loaded(container);
    expect(addButton(container).disabled).toBe(true);

    act(() => useBridge().quotas.applyQuotaUpdated(seats(1, 2) as never));
    expect(addButton(container).disabled).toBe(false);
    expect(container.querySelector('[data-bridge-seats-full]')).toBeNull();
  });

  it('an invite of more addresses than seats left is refused before anything is sent', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 3) as never);
    const { container } = render(<TeamUserList seatsMetric="seats" />);
    await loaded(container);

    fireEvent.click(addButton(container));
    const textarea = container.querySelector('#bridge-add-emails') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'a@example.com, b@example.com' } });
    const submit = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Add Members')!;
    await act(async () => {
      fireEvent.click(submit);
    });

    expect(created).toEqual([]);
    expect(container.textContent).toContain('Your plan has 1 seat left, and this invites 2.');
  });

  it('an invite that fits is sent, and the seat count is re-read', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 3) as never);
    const { container } = render(<TeamUserList seatsMetric="seats" />);
    await loaded(container);

    fireEvent.click(addButton(container));
    fireEvent.change(container.querySelector('#bridge-add-emails')!, { target: { value: 'a@example.com' } });
    const submit = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Add Members')!;
    await act(async () => {
      fireEvent.click(submit);
    });

    expect(created).toEqual([['a@example.com']]);
    expect(reReads).toContainEqual(['seats', 0]);
  });

  it('a removal re-reads the seat count', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 3) as never);
    const { container } = render(<TeamUserList seatsMetric="seats" />);
    await loaded(container);

    // Open the actions menu of the second member and delete them.
    const triggers = container.querySelectorAll('.bridge-team-actions-trigger');
    fireEvent.click(triggers[triggers.length - 1] as HTMLElement);
    fireEvent.click(container.querySelector('.bridge-team-actions-item--danger') as HTMLElement);
    const confirm = Array.from(container.querySelectorAll('dialog button')).find((b) => b.textContent === 'Delete')!;
    await act(async () => {
      fireEvent.click(confirm);
    });

    expect(reReads).toContainEqual(['seats', 0]);
  });

  it('a metered seat limit (extra seats billed) is never refused here', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 2, { policy: 'metered' }) as never);
    const { container } = render(<TeamUserList seatsMetric="seats" />);
    await loaded(container);
    expect(addButton(container).disabled).toBe(false);
  });

  it('TeamManagementPanel passes seatsMetric to the users tab', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 2) as never);
    const { container } = render(<TeamManagementPanel seatsMetric="seats" showProfileTab={false} showWorkspaceTab={false} />);
    await loaded(container);
    expect(addButton(container).disabled).toBe(true);
    // Not leaked onto the DOM as an unknown attribute.
    expect(container.querySelector('[seatsmetric]')).toBeNull();
  });
});

describe('the team page without seatsMetric is unchanged', () => {
  it('Add Member stays enabled even at a full seat quota, and no quota is read', async () => {
    useBridge().quotas.applyInitialSnapshot('seats', seats(2, 2) as never);
    const quota = spyOn(useBridge(), 'quota');
    spies.push(quota);
    const { container } = render(<TeamUserList />);
    await loaded(container);
    expect(addButton(container).disabled).toBe(false);
    expect(quota).not.toHaveBeenCalled();
    expect(container.querySelector('[data-bridge-seats-full]')).toBeNull();
  });
});

describe('seat helpers', () => {
  it('inviteSeatError: fits, one left, none left, unknown', () => {
    expect(inviteSeatError(1, 1)).toBeNull();
    expect(inviteSeatError(2, 1)).toBe('Your plan has 1 seat left, and this invites 2. Invite fewer people or upgrade your plan.');
    expect(inviteSeatError(1, 0)).toBe('All seats on your plan are taken. Upgrade your plan to invite more people.');
    expect(inviteSeatError(5, null)).toBeNull();
  });

  it('seatsLeftOf: unknown while loading or metered, never negative', () => {
    expect(seatsLeftOf(undefined)).toBeNull();
    expect(seatsLeftOf(seats(3, 2, { policy: 'metered' }) as never)).toBeNull();
    expect(seatsLeftOf(seats(3, 2) as never)).toBe(0);
    expect(seatsLeftOf(seats(1, 2) as never)).toBe(1);
  });
});
