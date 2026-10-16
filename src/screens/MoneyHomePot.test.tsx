import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyHomePot } from './MoneyHomePot';
import { Providers, money, entry } from './moneyFixtures';

const deleteMoneyEntry = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({ addMoneyEntry: vi.fn(async () => {}), deleteMoneyEntry: (...a: unknown[]) => deleteMoneyEntry(...(a as [])) }));

const entries = [
  entry({ id: 'h1', budgetId: 'home', by: 'a', amount: 3600, label: 'Groceries', day: '2026-10-16', createdAt: 5 }),
  entry({ id: 'h2', budgetId: 'home', by: 'b', amount: 500, label: 'Bulbs', day: '2026-10-16', createdAt: 6 }),
  entry({ id: 'h3', budgetId: 'home', by: 'b', amount: 100, label: 'Old', day: '2026-10-10', createdAt: 1 }),
];
const view = () => render(<Providers ctx={money({ entries: [entries[0], entries[1], entries[2]] })}><MoneyHomePot /></Providers>);

test('shows the pot, itemised entries with who logged them', () => {
  render(<Providers ctx={money({ entries: [entries[0]] })}><MoneyHomePot /></Providers>);
  expect(screen.getByText('£64.00 left this month')).toBeInTheDocument();
  expect(screen.getByText('of £100.00')).toBeInTheDocument();
  expect(screen.getByText('Groceries · Iman · £36.00')).toBeInTheDocument();
});

test('lists newest first', () => {
  render(<Providers ctx={money({ entries: [entries[2], entries[0]] })}><MoneyHomePot /></Providers>);
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items[0]).toContain('Groceries · Iman · £36.00');
  expect(items[1]).toContain('Old · Tahereh · £1.00');
});

test('only my own today entries can be deleted', async () => {
  view();
  expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Delete Bulbs £5.00' }));
  expect(deleteMoneyEntry).toHaveBeenCalledWith('c', 'h2');
});

test('＋ Home purchase opens the sheet on Home pot', async () => {
  view();
  await userEvent.click(screen.getByRole('button', { name: '＋ Home purchase' }));
  expect(screen.getByRole('dialog', { name: 'New purchase' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Home pot' })).toHaveAttribute('aria-checked', 'true');
});
