import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneySetup } from './MoneySetup';
import { Providers, money } from './moneyFixtures';

const setupPocketMoney = vi.fn(async () => {});
vi.mock('../firebase/repo', () => ({ setupPocketMoney: (...a: unknown[]) => setupPocketMoney(...(a as [])) }));
afterEach(() => vi.clearAllMocks());
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
const view = (budgets: ReturnType<typeof money>['budgets'] = []) =>
  render(<Providers ctx={money({ isSetUp: false, budgets })}><MoneySetup /></Providers>);

test('prefills the allowances and shows the time zone', () => {
  view();
  expect(screen.getByRole('heading', { name: '👛 Pocket Money' })).toBeInTheDocument();
  expect(screen.getByLabelText('Iman’s monthly allowance')).toHaveValue('200.00');
  expect(screen.getByLabelText('Tahereh’s monthly allowance')).toHaveValue('250.00');
  expect(screen.getByLabelText('Home pot per month')).toHaveValue('100.00');
  expect(screen.getByText(`Days follow ${tz} time.`)).toBeInTheDocument();
});

test('Start Pocket Money saves the edited amounts once', async () => {
  view();
  const iman = screen.getByLabelText('Iman’s monthly allowance');
  await userEvent.clear(iman);
  await userEvent.type(iman, '180');
  const start = screen.getByRole('button', { name: 'Start Pocket Money' });
  await userEvent.click(start);
  expect(setupPocketMoney).toHaveBeenCalledWith('c', { timeZone: tz, personal: { a: 18000, b: 25000 }, home: 10000, names: { a: 'Iman', b: 'Tahereh' } });
  expect(start).toBeDisabled();
  await userEvent.click(start);
  expect(setupPocketMoney).toHaveBeenCalledTimes(1);
});

test('an already-set-up rejection shows an alert and re-enables the button', async () => {
  setupPocketMoney.mockRejectedValueOnce(new Error('already-set-up'));
  view();
  await userEvent.click(screen.getByRole('button', { name: 'Start Pocket Money' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Pocket Money is already set up on another phone.');
  expect(screen.getByRole('button', { name: 'Start Pocket Money' })).toBeEnabled();
});

test('any other rejection shows the connection message', async () => {
  setupPocketMoney.mockRejectedValueOnce(new Error('unavailable'));
  view();
  await userEvent.click(screen.getByRole('button', { name: 'Start Pocket Money' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t set up — check your connection.');
});

test('an invalid amount disables the button', async () => {
  view();
  const iman = screen.getByLabelText('Iman’s monthly allowance');
  await userEvent.clear(iman);
  await userEvent.type(iman, 'abc');
  expect(screen.getByRole('button', { name: 'Start Pocket Money' })).toBeDisabled();
  expect(screen.getByText('Enter an amount like 250')).toBeInTheDocument();
});

test('does not call setup when budgets already exist', async () => {
  view(money().budgets);
  await userEvent.click(screen.getByRole('button', { name: 'Start Pocket Money' }));
  expect(setupPocketMoney).not.toHaveBeenCalled();
});
