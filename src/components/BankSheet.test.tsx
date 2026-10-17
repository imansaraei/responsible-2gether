import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BankSheet } from './BankSheet';
import { Providers, money, entry } from '../screens/moneyFixtures';

const addMoneyEntry = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({ addMoneyEntry: (...a: unknown[]) => addMoneyEntry(...(a as [])) }));
afterEach(() => vi.clearAllMocks());

// Tahereh: £250 a month, £50 spent in October, so £200 in the bank on 3 November (28 days left).
const renderSheet = () => {
  const onClose = vi.fn(); const onSaved = vi.fn();
  render(
    <Providers ctx={money({ today: '2026-11-03', entries: [entry({ id: 'o1', day: '2026-10-10', amount: 5000 })] })}>
      <BankSheet open onClose={onClose} onSaved={onSaved} />
    </Providers>,
  );
  return { onClose, onSaved };
};

test('moves an amount into this month, previewing the new daily allowance', async () => {
  const { onSaved, onClose } = renderSheet();
  expect(screen.getByRole('dialog', { name: 'Move to this month' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Amount'), '20');
  expect(screen.getByText('Daily allowance becomes £9.64')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Move' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('c',
    { budgetId: 'personal-b', by: 'b', day: '2026-11-03', amount: 2000, label: 'From Piggy Bank', kind: 'bank' }, expect.any(String));
  expect(onSaved).toHaveBeenCalledWith('£20.00 moved to this month');
  expect(onClose).toHaveBeenCalled();
});

test('rejects more than the balance', async () => {
  renderSheet();
  await userEvent.type(screen.getByLabelText('Amount'), '200.01');
  expect(screen.getByText('You have £200.00 in the Piggy Bank')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  expect(screen.queryByText(/Daily allowance becomes/)).toBeNull();
});

test('Move all fills the whole balance', async () => {
  renderSheet();
  await userEvent.click(screen.getByRole('button', { name: 'Move all £200.00' }));
  expect(screen.getByLabelText('Amount')).toHaveValue('200.00');
  // (£250 + £200) ÷ 28 days
  expect(screen.getByText('Daily allowance becomes £16.07')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled();
});

test('Escape and Cancel close without saving', async () => {
  const { onClose } = renderSheet();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(addMoneyEntry).not.toHaveBeenCalled();
});
