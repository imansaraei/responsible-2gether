import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Todo } from './Todo';

const setFeedbackResolved = vi.fn();
vi.mock('../firebase/repo', () => ({
  setFeedbackResolved: (...a: unknown[]) => setFeedbackResolved(...a),
  addLog: vi.fn(async () => {}),
  deleteLog: vi.fn(async () => {}),
}));
vi.mock('../firebase/hooks', () => ({
  useWeek: () => ({
    loading: false, completions: [], logs: [],
    feedback: [
      { id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plate left on sofa', createdAt: 2, resolved: false },
      { id: 'f2', from: 'b', to: 'a', kind: 'plus', text: 'Nice', createdAt: 3, resolved: false },
    ],
  }),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [{ id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 0, archivedAt: null }],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null },
  updateDevice: () => {},
};
const renderIt = () => render(<HouseholdContext.Provider value={ctx}><Todo /></HouseholdContext.Provider>);

test('shows the chore logger instead of percentages', () => {
  renderIt();
  expect(screen.getByRole('heading', { name: 'Log a chore' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cooking/ })).toHaveTextContent('45 min');
  expect(screen.queryByRole('radio', { name: '100' })).toBeNull();
});

test('negative feedback appears as a checkbox task', async () => {
  renderIt();
  expect(screen.queryByText('Nice')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: /Plate left on sofa/ }));
  expect(setFeedbackResolved).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W42', 'f1', true);
});
