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
  expect(screen.getByText('£10.63')).toBeInTheDocument();
  expect(screen.getByText('of £15.63')).toBeInTheDocument();
  expect(screen.getByText('£82.50')).toBeInTheDocument();
  expect(screen.getByText('of £87.50')).toBeInTheDocument();
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

test('No spending today failing shows an alert', async () => {
  addMoneyEntry.mockRejectedValueOnce(new Error('nope'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  view([]);
  await userEvent.click(screen.getByRole('button', { name: 'No spending today' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t log that. Try again.');
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

describe('Piggy Bank', () => {
  // October: £50 spent of £250, so £200 banked on 1 November.
  const october = [entry({ id: 'o1', day: '2026-10-10', amount: 5000 })];
  const november = (entries = october) => render(<Providers ctx={money({ today: '2026-11-03', entries })}><MoneyMine /></Providers>);

  test('shows the balance and the Move button', () => {
    november();
    const card = screen.getByRole('region', { name: 'Piggy Bank' });
    expect(card).toHaveTextContent('£200.00');
    expect(card).toHaveTextContent('Month-end leftovers land here.');
    expect(screen.getByText('Daily = money left this month ÷ days left.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to this month' })).toBeInTheDocument();
  });

  test('hides the Move button at £0', () => {
    view();
    expect(screen.getByRole('region', { name: 'Piggy Bank' })).toHaveTextContent('£0.00');
    expect(screen.queryByRole('button', { name: 'Move to this month' })).toBeNull();
  });

  test('Move to this month opens the sheet', async () => {
    november();
    await userEvent.click(screen.getByRole('button', { name: 'Move to this month' }));
    expect(screen.getByRole('dialog', { name: 'Move to this month' })).toBeInTheDocument();
  });

  test('a bank entry reads From Piggy Bank +£x and is deletable today', async () => {
    november([...october, entry({ id: 'k1', day: '2026-11-03', amount: 2000, label: 'From Piggy Bank', kind: 'bank' })]);
    expect(screen.getByText('From Piggy Bank')).toBeInTheDocument();
    expect(screen.getByText('+£20.00')).toHaveClass('entry-amount', 'in');
    expect(screen.getByRole('region', { name: 'Piggy Bank' })).toHaveTextContent('£180.00');
    expect(screen.getByText('of £9.64')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete From Piggy Bank +£20.00' }));
    expect(deleteMoneyEntry).toHaveBeenCalledWith('c', 'k1');
  });
});
