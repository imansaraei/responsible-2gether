import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { PocketMoneyContext, type PocketMoneyCtx } from '../state/PocketMoneyContext';
import type { Budget, MoneyEntry } from '../domain/types';
import { PurchaseSheet } from './PurchaseSheet';

const addMoneyEntry = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({ addMoneyEntry: (...a: unknown[]) => addMoneyEntry(...(a as [])) }));

const household: HouseholdCtx = {
  code: 'c', me: 'b', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [], device: { code: 'c', me: 'b', lastExportAt: Date.now() }, updateDevice: () => {},
};
const budgets: Budget[] = [
  { id: 'personal-b', name: 'Tahereh', owner: 'b', monthlyAmount: 25000, penalty: true, order: 1, createdAt: 1, archivedAt: null },
  { id: 'home', name: 'Home', owner: 'shared', monthlyAmount: 10000, penalty: false, order: 2, createdAt: 1, archivedAt: null },
];
const money = (entries: MoneyEntry[] = []): PocketMoneyCtx => ({
  loading: false, confirmed: true, isSetUp: true, timeZone: 'Europe/London', today: '2026-10-16', budgets, entries,
  budgetFor: (o) => budgets.find((b) => b.owner === o),
});
const renderSheet = (props: Partial<Parameters<typeof PurchaseSheet>[0]> = {}, entries: MoneyEntry[] = []) => {
  const onClose = vi.fn(); const onSaved = vi.fn();
  render(
    <HouseholdContext.Provider value={household}>
      <PocketMoneyContext.Provider value={money(entries)}>
        <PurchaseSheet open onClose={onClose} onSaved={onSaved} {...props} />
      </PocketMoneyContext.Provider>
    </HouseholdContext.Provider>,
  );
  return { onClose, onSaved };
};

afterEach(() => vi.clearAllMocks());

test('saving £5 to my allowance writes pence, today, me, and reports what is left', async () => {
  const { onSaved, onClose } = renderSheet();
  expect(screen.getByRole('dialog', { name: 'New purchase' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Amount'), '5');
  expect(screen.getByText('After this: £3.06 left today')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('What was it?'), 'Coffee');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('c',
    { budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 500, label: 'Coffee', kind: 'purchase' }, expect.any(String));
  expect(onSaved).toHaveBeenCalledWith('£5.00 — £3.06 left today');
  expect(onClose).toHaveBeenCalled();
});

test('Home source writes to the home budget and previews the pot', async () => {
  const { onSaved } = renderSheet({ source: 'home' });
  expect(screen.getByRole('radio', { name: 'Home pot' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.type(screen.getByLabelText('Amount'), '12.50');
  expect(screen.getByText('After this: £87.50 left in Home this month')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(addMoneyEntry).toHaveBeenCalledWith('c', expect.objectContaining({ budgetId: 'home', amount: 1250 }), expect.any(String));
  expect(onSaved).toHaveBeenCalledWith('£12.50 — £87.50 left in Home this month');
});

test('invalid amounts cannot be saved', async () => {
  renderSheet();
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Amount'), '1.234');
  expect(save).toBeDisabled();
  expect(screen.getByText('Enter an amount like 4.50')).toBeInTheDocument();
});

test('recent labels from my past entries are offered as chips', async () => {
  renderSheet({}, [
    { id: '1', budgetId: 'personal-b', by: 'b', day: '2026-10-15', amount: 300, label: 'Snap', kind: 'purchase', createdAt: 3 },
    { id: '2', budgetId: 'personal-b', by: 'b', day: '2026-10-14', amount: 300, label: 'Coffee', kind: 'purchase', createdAt: 2 },
    { id: '3', budgetId: 'personal-a', by: 'a', day: '2026-10-14', amount: 300, label: 'Not mine', kind: 'purchase', createdAt: 1 },
  ]);
  await userEvent.click(screen.getByRole('button', { name: 'Snap' }));
  expect(screen.getByLabelText('What was it?')).toHaveValue('Snap');
  expect(screen.queryByRole('button', { name: 'Not mine' })).toBeNull();
});

test('Escape and Cancel close without saving', async () => {
  const { onClose } = renderSheet();
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(addMoneyEntry).not.toHaveBeenCalled();
});
