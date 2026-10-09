import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Todo } from './Todo';

const setCompletion = vi.fn();
const setFeedbackResolved = vi.fn();
vi.mock('../firebase/repo', () => ({
  setCompletion: (...a: unknown[]) => setCompletion(...a),
  setFeedbackResolved: (...a: unknown[]) => setFeedbackResolved(...a),
}));
vi.mock('../firebase/hooks', () => ({
  useWeek: () => ({
    loading: false,
    completions: [],
    feedback: [
      { id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plate left on sofa', createdAt: 2, resolved: false },
      { id: 'f2', from: 'b', to: 'a', kind: 'plus', text: 'Nice', createdAt: 3, resolved: false },
    ],
  }),
}));

const ctx: HouseholdCtx = {
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W41',
  members: { a: { name: 'Iman' }, b: { name: 'Sam' } },
  chores: [
    { id: 'c1', name: 'Cooking', hours: 7, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Trash', hours: 1, assignee: 'b', createdAt: 1, archivedAt: null },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null },
  updateDevice: () => {},
};

test('lists only my chores and writes completion', async () => {
  render(<HouseholdContext.Provider value={ctx}><Todo /></HouseholdContext.Provider>);
  expect(screen.getByText('Cooking')).toBeInTheDocument();
  expect(screen.queryByText('Trash')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: '75' }));
  expect(setCompletion).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W41',
    { choreId: 'c1', name: 'Cooking', hours: 7, assignee: 'a', percent: 0 }, 75);
});

test('negative feedback appears as a checkbox task', async () => {
  render(<HouseholdContext.Provider value={ctx}><Todo /></HouseholdContext.Provider>);
  expect(screen.queryByText('Nice')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: /Plate left on sofa/ }));
  expect(setFeedbackResolved).toHaveBeenCalledWith('tidy-otter-maple-4821', '2026-W41', 'f1', true);
});
