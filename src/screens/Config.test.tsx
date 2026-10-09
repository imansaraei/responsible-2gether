import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Config, clampHours, parseHours } from './Config';

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
const wrap = (c: HouseholdCtx) => <HouseholdContext.Provider value={c}><Config /></HouseholdContext.Provider>;
const renderIt = () => render(wrap(ctx));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

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
  await userEvent.click(within(row).getByRole('button', { name: /Assigned to Iman/ }));
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

test('follows a remote rename and a no-op focus/blur does not write back', async () => {
  const { rerender } = renderIt();
  const input = screen.getByDisplayValue('Trash');
  rerender(wrap({ ...ctx, chores: ctx.chores.map((c) => (c.id === 'c2' ? { ...c, name: 'Bins' } : c)) }));
  expect(screen.getByDisplayValue('Bins')).toBe(input);
  await userEvent.click(input);
  await userEvent.tab();
  expect(updateChore).not.toHaveBeenCalled();
});

test('typing a new name and blurring writes it', async () => {
  renderIt();
  const input = screen.getByDisplayValue('Trash');
  await userEvent.clear(input);
  await userEvent.type(input, 'Bins');
  await userEvent.tab();
  expect(updateChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c2', { name: 'Bins' });
});

test('Enter commits via blur', async () => {
  renderIt();
  const input = screen.getByDisplayValue('Trash');
  await userEvent.type(input, 's{Enter}');
  expect(updateChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c2', { name: 'Trashs' });
});

test('blurring an emptied name reverts and does not write', async () => {
  renderIt();
  const input = screen.getByDisplayValue('Trash');
  await userEvent.clear(input);
  await userEvent.tab();
  expect(updateChore).not.toHaveBeenCalled();
  expect(input).toHaveValue('Trash');
});

test('hours are clamped on blur', async () => {
  renderIt();
  const input = screen.getByLabelText('Hours per week for chore 2');
  await userEvent.clear(input);
  await userEvent.type(input, '0.3');
  await userEvent.tab();
  expect(updateChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c2', { hours: 0.25 });
});

test('declined confirm does not archive', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderIt();
  const row = screen.getByDisplayValue('Trash').closest('li')!;
  await userEvent.click(within(row).getByRole('button', { name: /Remove/ }));
  expect(archiveChore).not.toHaveBeenCalled();
});

test.each([['1,5', 1.5], [' 2 ', 2], ['', null], ['   ', null], ['abc', null], ['0.3', 0.25]])('parseHours(%j) = %s', (i, o) => {
  expect(parseHours(i)).toBe(o);
});

test('blurring an emptied hours field reverts and does not write', async () => {
  renderIt();
  const input = screen.getByLabelText('Hours per week for chore 2');
  await userEvent.clear(input);
  await userEvent.tab();
  expect(updateChore).not.toHaveBeenCalled();
  expect(input).toHaveValue('0.5');
});

test('a comma decimal is accepted in a row', async () => {
  renderIt();
  const input = screen.getByLabelText('Hours per week for chore 2');
  await userEvent.clear(input);
  await userEvent.type(input, '1,5');
  await userEvent.tab();
  expect(updateChore).toHaveBeenCalledWith('tidy-otter-maple-4821', 'c2', { hours: 1.5 });
});

test('add form with empty hours does not add, keeps the form and explains', async () => {
  renderIt();
  await userEvent.type(screen.getByLabelText('New chore'), 'Vacuum');
  await userEvent.clear(screen.getByLabelText('Hours per week'));
  await userEvent.click(screen.getByRole('button', { name: 'Add chore' }));
  expect(addChore).not.toHaveBeenCalled();
  expect(screen.getByText('Enter hours, e.g. 1.5')).toBeInTheDocument();
  expect(screen.getByLabelText('New chore')).toHaveValue('Vacuum');
});
