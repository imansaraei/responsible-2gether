import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillsCard } from './BillsCard';
import { Providers, money } from '../screens/moneyFixtures';
import type { Bill } from '../domain/types';

const addBill = vi.fn(async () => {});
const archiveBill = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({
  addBill: (...a: unknown[]) => addBill(...(a as [])),
  archiveBill: (...a: unknown[]) => archiveBill(...(a as [])),
}));
afterEach(() => vi.clearAllMocks());

const bill = (p: Partial<Bill> & Pick<Bill, 'id'>): Bill => ({ owner: 'b', name: 'Phone', amount: 1500, createdAt: 1, archivedAt: null, ...p });
const view = (bills: Bill[]) => render(<Providers ctx={money({ bills })}><BillsCard monthAllowance={25000} /></Providers>);

test('lists my bills only, with the total line', () => {
  view([bill({ id: '1' }), bill({ id: '2', name: 'Gym', amount: 3000 }), bill({ id: '3', owner: 'a', name: 'Car' })]);
  const card = screen.getByRole('region', { name: 'Bills' });
  expect(card).toHaveTextContent('Phone');
  expect(card).toHaveTextContent('Gym');
  expect(card).not.toHaveTextContent('Car');
  expect(screen.getByText('This month: allowance £250.00 + bills £45.00 = £295.00')).toBeInTheDocument();
});

test('Remove archives the bill', async () => {
  view([bill({ id: '1' })]);
  await userEvent.click(screen.getByRole('button', { name: 'Remove Phone' }));
  expect(archiveBill).toHaveBeenCalledWith('c', '1');
});

test('＋ Bill adds one for me', async () => {
  view([]);
  expect(screen.getByText('No bills yet.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '＋ Bill' }));
  const sheet = screen.getByRole('dialog', { name: 'New bill' });
  await userEvent.type(within(sheet).getByLabelText('Name'), 'Netflix');
  await userEvent.type(within(sheet).getByLabelText('Amount a month'), '10.99');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Add bill' }));
  expect(addBill).toHaveBeenCalledWith('c', { owner: 'b', name: 'Netflix', amount: 1099 });
});
