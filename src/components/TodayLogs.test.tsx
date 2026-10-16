import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { ChoreLog } from '../domain/types';
import { todayKey } from '../domain/blocks';
import { TodayLogs } from './TodayLogs';

const deleteLog = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({ deleteLog: (...a: unknown[]) => deleteLog(...(a as [])) }));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null },
  updateDevice: () => {},
};
const day = todayKey();
const l = (p: Partial<ChoreLog>): ChoreLog => ({
  id: 'x', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 1, minutes: 45, day, createdAt: 1, ...p,
});
const renderIt = (logs: ChoreLog[]) =>
  render(<HouseholdContext.Provider value={ctx}><TodayLogs logs={logs} /></HouseholdContext.Provider>);

afterEach(() => vi.clearAllMocks());

test('lists only my logs from today, newest first', () => {
  renderIt([
    l({ id: 'l1', name: 'Cooking', minutes: 45, createdAt: 1 }),
    l({ id: 'l2', name: 'Trash', minutes: 5, createdAt: 3 }),
    l({ id: 'l3', name: 'Dishes', by: 'b', createdAt: 4 }),
    l({ id: 'l4', name: 'Fridge', day: '2000-01-01', createdAt: 5 }),
  ]);
  const items = screen.getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('Trash · 5 m');
  expect(items[1]).toHaveTextContent('Cooking · 45 m');
  expect(items).toHaveLength(2);
});

test('delete removes that log from the current week', async () => {
  renderIt([l({ id: 'l1', name: 'Cooking', minutes: 45 })]);
  await userEvent.click(screen.getByRole('button', { name: 'Delete Cooking 45 m' }));
  expect(deleteLog).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W42', 'l1');
});

test('a failed delete shows an alert', async () => {
  deleteLog.mockRejectedValueOnce(new Error('x'));
  renderIt([l({ id: 'l1' })]);
  await userEvent.click(screen.getByRole('button', { name: /Delete Cooking/ }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

test('empty state', () => {
  renderIt([l({ by: 'b' })]);
  expect(screen.getByText('Nothing logged today yet.')).toBeInTheDocument();
  expect(screen.queryByRole('list')).toBeNull();
});
