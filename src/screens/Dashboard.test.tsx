import { render, screen } from '@testing-library/react';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { Dashboard } from './Dashboard';

const legacyData = {
  completions: [{ choreId: 'c1', percent: 100, name: 'Cooking', hours: 7, assignee: 'a', updatedAt: 1 }],
  feedback: [
    { id: 'f1', from: 'b', to: 'a', kind: 'plus', text: 'Lovely dinner', createdAt: 2, resolved: false },
    { id: 'f2', from: 'a', to: 'b', kind: 'minus', text: 'Towels on floor', createdAt: 3, resolved: false },
  ],
  logs: [] as unknown[],
};
let weekData: { completions: unknown[]; feedback: unknown[]; logs: unknown[] } = legacyData;
vi.mock('../firebase/hooks', () => ({ useWeek: () => ({ loading: false, ...weekData }) }));

beforeEach(() => { weekData = legacyData; });

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

test('blocks week: minutes per person, chore legend in minutes, logged total in the centre', () => {
  weekData = {
    completions: [], feedback: [],
    logs: [
      { id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 2, minutes: 90, day: '2026-10-13', createdAt: 1 },
      { id: 'l2', choreId: 'c2', name: 'Trash', by: 'b', multiplier: 1, minutes: 30, day: '2026-10-14', createdAt: 2 },
    ],
  };
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getByTestId('share-a')).toHaveTextContent('75%');
  expect(screen.getByTestId('share-b')).toHaveTextContent('25%');
  expect(screen.getByText('2 h')).toBeInTheDocument();
  expect(screen.getByText('logged this week')).toBeInTheDocument();
  expect(screen.getByText('1 h 30 m')).toBeInTheDocument();
  expect(screen.queryByText(/of /)).toBeNull();
});

test('legacy week: percent-era week shown as minutes of planned', () => {
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getByText(/Rated with percentages/)).toBeInTheDocument();
  expect(screen.getByText('of 8 h')).toBeInTheDocument();      // planned 7 h + 1 h
  expect(screen.getAllByText('7 h').length).toBeGreaterThanOrEqual(2); // centre done + Cooking legend
  expect(screen.getByText('7 h done')).toBeInTheDocument();   // Iman footer
});

test('empty week: nothing logged, no legacy note', () => {
  weekData = { completions: [], feedback: [], logs: [] };
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getByText('Nothing logged yet')).toBeInTheDocument();
  expect(screen.queryByText(/Rated with percentages/)).toBeNull();
});

test('blocks week: member footers read logged minutes', () => {
  weekData = {
    completions: [], feedback: [],
    logs: [
      { id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 2, minutes: 90, day: '2026-10-13', createdAt: 1 },
      { id: 'l2', choreId: 'c2', name: 'Trash', by: 'b', multiplier: 1, minutes: 30, day: '2026-10-14', createdAt: 2 },
    ],
  };
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getByText('1 h 30 m logged')).toBeInTheDocument();
  expect(screen.getByText('30 m logged')).toBeInTheDocument();
});

test('mixed week: notes the percentage ratings and labels the total as logged', () => {
  weekData = {
    ...legacyData,
    logs: [{ id: 'l1', choreId: 'c2', name: 'Trash', by: 'b', multiplier: 1, minutes: 30, day: '2026-10-14', createdAt: 2 }],
  };
  render(<HouseholdContext.Provider value={ctx}><Dashboard /></HouseholdContext.Provider>);
  expect(screen.getByText('Includes percentage ratings from before time blocks.')).toBeInTheDocument();
  expect(screen.getByText('logged this week')).toBeInTheDocument();
  expect(screen.queryByText(/Rated with percentages/)).toBeNull();
});
