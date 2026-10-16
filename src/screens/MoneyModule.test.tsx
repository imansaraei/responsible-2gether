import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyModule } from './MoneyModule';
import { Providers, money, budgets } from './moneyFixtures';

vi.mock('./MoneySetup', () => ({ MoneySetup: () => <p>setup screen</p> }));
vi.mock('./MoneyMine', () => ({ MoneyMine: () => <p>mine screen</p> }));
vi.mock('./MoneyFamily', () => ({ MoneyFamily: () => <p>family screen</p> }));
vi.mock('./MoneyHomePot', () => ({ MoneyHomePot: () => <p>home screen</p> }));

const view = (section: 'family' | 'mine' | 'home', ctx = money(), onSection = vi.fn()) => {
  render(<Providers ctx={ctx}><MoneyModule section={section} onSection={onSection} /></Providers>);
  return onSection;
};

test('not set up shows setup and no tabs', () => {
  view('mine', money({ isSetUp: false, budgets: [] }));
  expect(screen.getByText('setup screen')).toBeInTheDocument();
  expect(screen.queryByRole('tab')).toBeNull();
});

test('unconfirmed and empty shows the connect message and no setup form', () => {
  view('mine', money({ confirmed: false, isSetUp: false, budgets: [] }));
  expect(screen.getByText('Connect to the internet to set up Pocket Money.')).toBeInTheDocument();
  expect(screen.queryByText('setup screen')).toBeNull();
  expect(screen.queryByRole('tab')).toBeNull();
});

test('loading shows Loading…', () => {
  view('mine', money({ loading: true, isSetUp: false, budgets: [] }));
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  expect(screen.queryByText('setup screen')).toBeNull();
});

test('settings missing but budgets present still shows the views', () => {
  view('mine', money({ isSetUp: false, budgets }));
  expect(screen.getByText('mine screen')).toBeInTheDocument();
});

test('renders title, tabs in order and the requested section', () => {
  view('mine');
  expect(screen.getByRole('heading', { name: '👛 Pocket Money' })).toBeInTheDocument();
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((t) => t.textContent)).toEqual(['Family', 'Mine', 'Home pot']);
  expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  expect(screen.getByText('mine screen')).toBeInTheDocument();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'money-tab-mine');
});

test('clicks, arrows, Home and End report sections', async () => {
  const onSection = view('mine');
  await userEvent.click(screen.getByRole('tab', { name: 'Home pot' }));
  expect(onSection).toHaveBeenLastCalledWith('home');
  screen.getByRole('tab', { name: 'Mine' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(onSection).toHaveBeenLastCalledWith('home');
  await userEvent.keyboard('{Home}');
  expect(onSection).toHaveBeenLastCalledWith('family');
  await userEvent.keyboard('{End}');
  expect(onSection).toHaveBeenLastCalledWith('home');
  await userEvent.keyboard('{ArrowLeft}');
  expect(onSection).toHaveBeenLastCalledWith('family');
});
