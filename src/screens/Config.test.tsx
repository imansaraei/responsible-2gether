import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Config, clampHours } from './Config';

const addChore = vi.fn(), updateChore = vi.fn(), archiveChore = vi.fn();
vi.mock('../firebase/repo', () => ({
  addChore: (...a: unknown[]) => addChore(...a),
  updateChore: (...a: unknown[]) => updateChore(...a),
  archiveChore: (...a: unknown[]) => archiveChore(...a),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } },
  chores: [
    { id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Trash', hours: 0.5, assignee: 'b', createdAt: 1, archivedAt: null },
    { id: 'c3', name: 'Old', hours: 1, assignee: 'b', createdAt: 2, archivedAt: 5 },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null }, updateDevice: () => {},
};
const renderIt = () => render(<HouseholdContext.Provider value={ctx}><Config /></HouseholdContext.Provider>);

test.each([[0, 0.25], [0.3, 0.25], [0.4, 0.5], [99, 40], [Number.NaN, 0.25]])('clampHours(%s) = %s', (i, o) => {
  expect(clampHours(i)).toBe(o);
});

test('lists active chores with per-person totals', () => {
  renderIt();
  expect(screen.getByDisplayValue('Cooking')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('Old')).not.toBeInTheDocument();
  expect(screen.getByTestId('total-a')).toHaveTextContent('7 h');
  expect(screen.getByTestId('total-b')).toHaveTextContent('0.5 h');
});

test('assignee toggle swaps person', async () => {
  renderIt();
  const row = screen.getByDisplayValue('Cooking').closest('li')!;
  await userEvent.click(within(row).getByRole('button', { name: 'Iman' }));
  expect(updateChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c1', { assignee: 'b' });
});

test('remove archives after confirm', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderIt();
  const row = screen.getByDisplayValue('Trash').closest('li')!;
  await userEvent.click(within(row).getByRole('button', { name: /Remove/ }));
  expect(archiveChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c2');
});

test('adds a chore', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('New chore'), 'Vacuum');
  await userEvent.clear(screen.getByLabelText('Hours per week'));
  await userEvent.type(screen.getByLabelText('Hours per week'), '1.5');
  await userEvent.click(screen.getByRole('button', { name: 'Add chore' }));
  expect(addChore).toHaveBeenCalledWith('tidy-otter-maple-4821', { name: 'Vacuum', hours: 1.5, assignee: 'a' });
});
