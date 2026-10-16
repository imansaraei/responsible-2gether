import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyMine } from './MoneyMine';
import { Providers, money, entry } from './moneyFixtures';

const addMoneyEntry = vi.fn(async () => {});
const deleteMoneyEntry = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({
  addMoneyEntry: (...a: unknown[]) => addMoneyEntry(...(a as [])),
  deleteMoneyEntry: (...a: unknown[]) => deleteMoneyEntry(...(a as [])),
}));
afterEach(() => vi.clearAllMocks());
const view = (entries = [entry({ id: 'e1' })]) => render(<Providers ctx={money({ entries })}><MoneyMine /></Providers>);

test('shows today, week and month tiles', () => {
  view();
  expect(screen.getByText('£3.06')).toBeInTheDocument();
  expect(screen.getByText('of £8.06')).toBeInTheDocument();
  expect(screen.getByText('£51.45')).toBeInTheDocument();
  expect(screen.getByText('of £56.45')).toBeInTheDocument();
  expect(screen.getByText('£245.00')).toBeInTheDocument();
  expect(screen.getByText('of £250.00')).toBeInTheDocument();
});

test('No spending today is hidden once today is logged', () => {
  view();
  expect(screen.queryByRole('button', { name: 'No spending today' })).toBeNull();
});

test('No spending today logs a check-in', async () => {
  view([]);
  expect(screen.getByText('Nothing logged this week yet.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'No spending today' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('c',
    { budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 0, label: '', kind: 'nothing' }, expect.any(String));
});

test('lists this week, delete only for today, never the partner', async () => {
  view([
    entry({ id: 'e1' }),
    entry({ id: 'e2', day: '2026-10-14', label: 'Bus', amount: 250 }),
    entry({ id: 'e3', by: 'a', budgetId: 'personal-a', label: 'Secret', amount: 900 }),
  ]);
  expect(screen.getByText('Coffee')).toBeInTheDocument();
  expect(screen.getByText('Bus')).toBeInTheDocument();
  expect(screen.getByText('Fri 16 Oct')).toBeInTheDocument();
  expect(screen.queryByText('Secret')).toBeNull();
  expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Delete Coffee £5.00' }));
  expect(deleteMoneyEntry).toHaveBeenCalledWith('c', 'e1');
});

test('a nothing entry reads No spending ✓', () => {
  view([entry({ id: 'n', amount: 0, label: '', kind: 'nothing' })]);
  expect(screen.getByText('No spending ✓')).toBeInTheDocument();
});

test('＋ Purchase opens the sheet', async () => {
  view();
  await userEvent.click(screen.getByRole('button', { name: '＋ Purchase' }));
  expect(screen.getByRole('dialog', { name: 'New purchase' })).toBeInTheDocument();
});
