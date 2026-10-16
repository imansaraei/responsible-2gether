import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { Completion, Feedback } from '../domain/types';
import { Home } from './Home';

let completions: Completion[] = [];
let feedback: Feedback[] = [];
let loading = false;
vi.mock('../firebase/hooks', () => ({ useWeek: () => ({ loading, completions, feedback }) }));

const ctx = (over: Partial<HouseholdCtx> = {}): HouseholdCtx => ({
  code: 'tidy-otter-maple-4821', me: 'a', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [
    { id: 'c1', name: 'Cooking', hours: 6, assignee: 'a', createdAt: 0, archivedAt: null },
    { id: 'c2', name: 'Trash', hours: 4, assignee: 'b', createdAt: 1, archivedAt: null },
  ],
  device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: Date.now() },
  updateDevice: () => {},
  ...over,
});
const renderHome = (onNavigate = vi.fn(), over: Partial<HouseholdCtx> = {}) => {
  render(<HouseholdContext.Provider value={ctx(over)}><Home onNavigate={onNavigate} /></HouseholdContext.Provider>);
  return onNavigate;
};

beforeEach(() => { completions = []; feedback = []; loading = false; });

test('greets the person on this phone under the Khooneh title', () => {
  renderHome();
  expect(screen.getByRole('heading', { level: 1, name: 'Khooneh' })).toBeInTheDocument();
  expect(screen.getByText('Hi Iman')).toBeInTheDocument();
});

test('Tidy Together card shows this week’s split with "You" first', () => {
  completions = [
    { choreId: 'c1', percent: 100, name: 'Cooking', hours: 6, assignee: 'a', updatedAt: 1 },
    { choreId: 'c2', percent: 100, name: 'Trash', hours: 4, assignee: 'b', updatedAt: 1 },
  ];
  renderHome();
  expect(screen.getByText('You 60% · Tahereh 40%')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(document.querySelector('.split-bar')).toHaveAttribute('aria-hidden', 'true');
});

test('Tidy Together card says nothing logged when the week is empty', () => {
  renderHome();
  expect(screen.getByText('Nothing logged yet this week')).toBeInTheDocument();
});

test('＋ Chore and the Tidy Together card navigate into the chores module', async () => {
  const nav = renderHome();
  await userEvent.click(screen.getByRole('button', { name: '＋ Chore' }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'chores', section: 'todo' });
  await userEvent.click(screen.getByRole('button', { name: /Tidy Together/ }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'chores', section: 'week' });
});

test('Pocket Money card is marked coming soon and opens the Money tab', async () => {
  const nav = renderHome();
  const card = screen.getByRole('button', { name: /Pocket Money/ });
  expect(card).toHaveTextContent(/Coming soon/);
  await userEvent.click(card);
  expect(nav).toHaveBeenLastCalledWith({ tab: 'money' });
});

test('unresolved negative feedback for me shows an alert that opens To-do', async () => {
  feedback = [
    { id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plates', createdAt: 1, resolved: false },
    { id: 'f2', from: 'b', to: 'a', kind: 'minus', text: 'Towels', createdAt: 2, resolved: false },
    { id: 'f3', from: 'b', to: 'a', kind: 'minus', text: 'Done', createdAt: 3, resolved: true },
    { id: 'f4', from: 'a', to: 'b', kind: 'minus', text: 'Not mine', createdAt: 4, resolved: false },
  ];
  const nav = renderHome();
  await userEvent.click(screen.getByRole('button', { name: '2 feedback notes to act on ›' }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'chores', section: 'todo' });
});

test('no feedback alert when nothing is pending', () => {
  renderHome();
  expect(screen.queryByText(/to act on/)).toBeNull();
});

test('singular wording for one pending note', () => {
  feedback = [{ id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plates', createdAt: 1, resolved: false }];
  renderHome();
  expect(screen.getByRole('button', { name: '1 feedback note to act on ›' })).toBeInTheDocument();
});

test('backup reminder appears on Home when an export is overdue and opens Settings', async () => {
  const nav = renderHome(vi.fn(), { device: { code: 'tidy-otter-maple-4821', me: 'a', lastExportAt: null } });
  await userEvent.click(screen.getByRole('button', { name: 'Back up your data ›' }));
  expect(nav).toHaveBeenLastCalledWith({ tab: 'settings' });
});

test('while the week is loading, the card shows Loading… and no feedback alert', () => {
  loading = true;
  feedback = [{ id: 'f1', from: 'b', to: 'a', kind: 'minus', text: 'Plates', createdAt: 1, resolved: false }];
  renderHome();
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  expect(screen.queryByText('Nothing logged yet this week')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /feedback note/ })).not.toBeInTheDocument();
});
