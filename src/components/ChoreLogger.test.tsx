import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { ChoreLog } from '../domain/types';
import { todayKey } from '../domain/blocks';
import { ChoreLogger } from './ChoreLogger';

const addLog = vi.fn(async () => {});
const deleteLog = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({
  addLog: (...a: unknown[]) => addLog(...(a as [])),
  deleteLog: (...a: unknown[]) => deleteLog(...(a as [])),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [
    { id: 'c1', name: 'Load the dishwasher', hours: 1.5, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Cooking', hours: 7, assignee: 'b', createdAt: 1, archivedAt: null, blockMinutes: 30 },
    { id: 'c3', name: 'Old', hours: 1, assignee: 'a', createdAt: 2, archivedAt: 5 },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: Date.now() },
  updateDevice: () => {},
};
const renderIt = (logs: ChoreLog[] = [], c: HouseholdCtx = ctx) =>
  render(<HouseholdContext.Provider value={c}><ChoreLogger logs={logs} /></HouseholdContext.Provider>);

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

test('lists active chores, mine first, with block length; archived hidden', () => {
  renderIt();
  const rows = screen.getAllByRole('button', { name: /min/ });
  expect(rows.map((r) => r.textContent)).toEqual([
    expect.stringContaining('Load the dishwasher'),
    expect.stringContaining('Cooking'),
  ]);
  expect(rows[0]).toHaveTextContent('15 min');
  expect(rows[1]).toHaveTextContent('30 min');
  expect(screen.queryByText('Old')).toBeNull();
  expect(screen.getByText('Yours')).toBeInTheDocument();
  expect(screen.getByText('Tahereh’s')).toBeInTheDocument();
});

test('shows today’s count of my logs per chore', () => {
  const day = todayKey();
  renderIt([
    { id: 'l1', choreId: 'c1', name: 'Load the dishwasher', by: 'a', multiplier: 1, minutes: 15, day, createdAt: 1 },
    { id: 'l2', choreId: 'c1', name: 'Load the dishwasher', by: 'a', multiplier: 2, minutes: 30, day, createdAt: 2 },
    { id: 'l3', choreId: 'c1', name: 'Load the dishwasher', by: 'b', multiplier: 1, minutes: 15, day, createdAt: 3 },
  ]);
  expect(screen.getByRole('button', { name: /Load the dishwasher/ })).toHaveTextContent('✓ 2 today');
});

test('expand, pick 2×, Add logs 30 minutes for me today in the current week', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Load the dishwasher/ }));
  const group = screen.getByRole('radiogroup', { name: 'How many times' });
  expect(within(group).getByRole('radio', { name: '1×' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(within(group).getByRole('radio', { name: '2×' }));
  expect(screen.getByText('= 30 min')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(addLog).toHaveBeenCalledWith(
    'tidy-otter-maple-4821', '2026-W42',
    { chore: { id: 'c1', name: 'Load the dishwasher' }, by: 'a', multiplier: 2, blockMinutes: 15, day: todayKey() },
    expect.any(String),
  );
  expect(screen.getByRole('status')).toHaveTextContent('Logged 30 m · Load the dishwasher');
});

test('Undo deletes the log that was just added', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Cooking/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  const id = (addLog.mock.calls[0] as unknown[])[3];
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(deleteLog).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W42', id);
  expect(screen.queryByRole('status')).toBeNull();
});

test('the undo toast disappears after 10 seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  renderIt();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.click(screen.getByRole('button', { name: /Cooking/ }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(screen.getByRole('status')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(screen.queryByRole('status')).toBeNull();
});

test('undo after a week rollover deletes from the original week', async () => {
  const { rerender } = renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Cooking/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  rerender(<HouseholdContext.Provider value={{ ...ctx, currentWeekId: '2026-W43' }}><ChoreLogger logs={[]} /></HouseholdContext.Provider>);
  await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(deleteLog).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W42', expect.any(String));
});

test('a failed write shows an alert, cleared by the next successful Add', async () => {
  addLog.mockRejectedValueOnce(new Error('x'));
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Cooking/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save — check your connection.');
  await userEvent.click(screen.getByRole('button', { name: /Cooking/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(screen.queryByRole('alert')).toBeNull();
});

test('focus returns to the row after Add', async () => {
  renderIt();
  await userEvent.click(screen.getByRole('button', { name: /Cooking/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(screen.getByRole('button', { name: /Cooking/ })).toHaveFocus();
});

test('empty state when there are no active chores', () => {
  renderIt([], { ...ctx, chores: [] });
  expect(screen.getByText('No chores yet — add some in Setup.')).toBeInTheDocument();
});
