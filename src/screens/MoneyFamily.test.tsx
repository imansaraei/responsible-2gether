import { render, screen } from '@testing-library/react';
import { MoneyFamily } from './MoneyFamily';
import { Providers, money, entry } from './moneyFixtures';

test('shows only totals per person and Home, no labels', () => {
  render(<Providers ctx={money({ entries: [
    entry({ id: '1', by: 'a', budgetId: 'personal-a', amount: 2000, label: 'Lunch' }),
    entry({ id: '2', amount: 500, label: 'Coffee' }),
    entry({ id: '3', budgetId: 'home', amount: 3600, label: 'Groceries' }),
  ] })}><MoneyFamily /></Providers>);
  expect(screen.getByText('Iman')).toBeInTheDocument();
  expect(screen.getByText('£180.00 left')).toBeInTheDocument();
  expect(screen.getByText('£20.00 spent')).toBeInTheDocument();
  expect(screen.getByText('Tahereh')).toBeInTheDocument();
  expect(screen.getByText('£245.00 left')).toBeInTheDocument();
  expect(screen.getByText('£5.00 spent')).toBeInTheDocument();
  expect(screen.getByText('Home pot')).toBeInTheDocument();
  expect(screen.getByText('£64.00 left')).toBeInTheDocument();
  for (const l of ['Lunch', 'Coffee', 'Groceries']) expect(screen.queryByText(l)).toBeNull();
  expect(screen.getByText('Totals only — each person’s purchases stay private to them.')).toBeInTheDocument();
});

test('shows each person’s Piggy Bank, not the Home pot’s', () => {
  render(<Providers ctx={money({ today: '2026-11-03', entries: [
    entry({ id: '1', by: 'a', budgetId: 'personal-a', day: '2026-10-05', amount: 2000 }),
    entry({ id: '2', day: '2026-10-05', amount: 25000 }),
    entry({ id: '3', budgetId: 'home', day: '2026-10-05', amount: 3600 }),
  ] })}><MoneyFamily /></Providers>);
  expect(screen.getByText('Piggy Bank £180.00')).toBeInTheDocument();
  expect(screen.getByText('Piggy Bank £0.00')).toBeInTheDocument();
  expect(screen.getAllByText(/^Piggy Bank/)).toHaveLength(2);
});

test('shows each person’s bills and allowance + bills total, itemised for both', () => {
  render(<Providers ctx={money({ bills: [
    { id: 'b1', owner: 'a', name: 'Phone', amount: 1500, createdAt: 1, archivedAt: null },
    { id: 'b2', owner: 'b', name: 'Gym', amount: 3000, createdAt: 1, archivedAt: null },
  ] })}><MoneyFamily /></Providers>);
  expect(screen.getByText('Bills £15.00 · Total £215.00')).toBeInTheDocument();
  expect(screen.getByText('Bills £30.00 · Total £280.00')).toBeInTheDocument();
  expect(screen.getByText('Phone £15.00')).toBeInTheDocument();
  expect(screen.getByText('Gym £30.00')).toBeInTheDocument();
});
