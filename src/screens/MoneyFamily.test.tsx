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
