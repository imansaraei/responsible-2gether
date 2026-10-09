import { render, screen } from '@testing-library/react';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Dashboard } from './Dashboard';

vi.mock('../firebase/hooks', () => ({
  useWeek: () => ({
    loading: false,
    completions: [{ choreId: 'c1', percent: 100, name: 'Cooking', hours: 7, assignee: 'a', updatedAt: 1 }],
    feedback: [
      { id: 'f1', from: 'b', to: 'a', kind: 'plus', text: 'Lovely dinner', createdAt: 2, resolved: false },
      { id: 'f2', from: 'a', to: 'b', kind: 'minus', text: 'Towels on floor', createdAt: 3, resolved: false },
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
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: Date.now() },
  updateDevice: () => {},
};

test('shows shares, helpfulness and kind words for me', () => {
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getAllByText('Iman').length).toBeGreaterThan(0);
  expect(screen.getByTestId('share-a')).toHaveTextContent('100%');
  expect(screen.getByRole('meter', { name: /Sam helpfulness/ })).toHaveAttribute('aria-valuenow', '90');
  expect(screen.getByRole('meter', { name: /Iman helpfulness/ })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByText(/Lovely dinner/)).toBeInTheDocument();
  expect(screen.queryByText(/Towels on floor/)).not.toBeInTheDocument();
});
