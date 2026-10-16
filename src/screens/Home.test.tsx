import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import type { ChoreLog, Completion, Feedback } from '../domain/types';
import { PocketMoneyContext, type PocketMoneyCtx } from '../state/PocketMoneyContext';
import type { MoneyEntry } from '../domain/types';
import { money as moneyFixture, budgets } from './moneyFixtures';
import { addMoneyEntry } from '../firebase/repo';
import { Home } from './Home';

vi.mock('../firebase/repo', () => ({ addMoneyEntry: vi.fn(async () => {}) }));
const notSetUp: PocketMoneyCtx = {
  loading: false, isSetUp: false, timeZone: 'Europe/London', today: '2026-10-16', budgets: [], entries: [],
  budgetFor: () => undefined,
};
let money: PocketMoneyCtx = notSetUp;
const setUpMoney = (entries: MoneyEntry[]): PocketMoneyCtx => moneyFixture({ entries, budgets });

let completions: Completion[] = [];
let feedback: Feedback[] = [];
let logs: ChoreLog[] = [];
let loading = false;
vi.mock('../firebase/hooks', () => ({ useWeek: () => ({ loading, completions, feedback, logs }) }));

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
  render(<HouseholdContext.Provider value={ctx(over)}><PocketMoneyContext.Provider value={money}><Home onNavigate={onNavigate} /></PocketMoneyContext.Provider></HouseholdContext.Provider>);
  return onNavigate;
};

beforeEach(() => { money = notSetUp; vi.mocked(addMoneyEntry).mockClear(); vi.mocked(addMoneyEntry).mockImplementation(async () => {}); logs = []; completions = []; feedback = []; loading = false; });

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

test('not set up: Pocket Money card offers setup and opens Money', async () => {
  const nav = renderHome();
  await userEvent.click(screen.getByRole('button', { name: /Pocket Money/ }));
  expect(screen.getByRole('button', { name: /Pocket Money/ })).toHaveTextContent('Set up your allowances');
  expect(nav).toHaveBeenLastCalledWith({ tab: 'money' });
  expect(screen.queryByText(/left today/)).toBeNull();
});

test('while money is loading the card shows Loading…, not the setup prompt', () => {
  money = { ...notSetUp, loading: true };
  renderHome();
  expect(screen.getByRole('button', { name: /Pocket Money/ })).toHaveTextContent('Loading…');
  expect(screen.queryByText('Set up your allowances')).toBeNull();
});

test('set up: today strip shows what is left and the family card shows totals only', async () => {
  money = setUpMoney([{ id: 'e1', budgetId: 'personal-a', by: 'a', day: '2026-10-16', amount: 500, label: 'Coffee', kind: 'purchase', createdAt: 1 }]);
  const nav = renderHome();
  expect(screen.getByText('£1.45')).toBeInTheDocument();
  expect(screen.getByText('left today')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'My pocket money today' })).toHaveTextContent(/this week/);
  const card = screen.getByRole('button', { name: /Pocket Money/ });
  expect(card).toHaveTextContent('You £195.00 left');
  expect(card).toHaveTextContent('Tahereh £250.00 left');
  expect(card).toHaveTextContent('Home £100.00 left');
  expect(card).not.toHaveTextContent('Coffee');
  await userEvent.click(card);
  expect(nav).toHaveBeenLastCalledWith({ tab: 'money', moneySection: 'family' });
});

test('＋ Purchase opens the sheet; No spending today logs a £0 check-in', async () => {
  money = setUpMoney([]);
  renderHome();
  await userEvent.click(screen.getByRole('button', { name: 'No spending today' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('tidy-otter-maple-4821',
    { budgetId: 'personal-a', by: 'a', day: '2026-10-16', amount: 0, label: '', kind: 'nothing' }, expect.any(String));
  expect(screen.getByRole('status')).toHaveTextContent('Logged: no spending today');
  await userEvent.click(screen.getByRole('button', { name: '＋ Purchase' }));
  expect(screen.getByRole('dialog', { name: 'New purchase' })).toBeInTheDocument();
});

test('No spending today is hidden once something is logged today', () => {
  money = setUpMoney([{ id: 'e1', budgetId: 'personal-a', by: 'a', day: '2026-10-16', amount: 0, label: '', kind: 'nothing', createdAt: 1 }]);
  renderHome();
  expect(screen.queryByRole('button', { name: 'No spending today' })).toBeNull();
});

test('a failed No spending today write shows an alert', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(addMoneyEntry).mockRejectedValueOnce(new Error('nope'));
  money = setUpMoney([]);
  renderHome();
  await userEvent.click(screen.getByRole('button', { name: 'No spending today' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t log/);
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

test('Tidy Together card uses logged minutes when the week has logs', () => {
  logs = [
    { id: 'l1', choreId: 'c1', name: 'Cooking', by: 'a', multiplier: 1, minutes: 45, day: '2026-10-13', createdAt: 1 },
    { id: 'l2', choreId: 'c2', name: 'Trash', by: 'b', multiplier: 3, minutes: 15, day: '2026-10-13', createdAt: 2 },
  ];
  renderHome();
  expect(screen.getByText('You 75% · Tahereh 25%')).toBeInTheDocument();
});
