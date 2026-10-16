import { render, screen } from '@testing-library/react';
import { PocketMoneyProvider, usePocketMoney } from './PocketMoneyContext';

let money = { settings: null as null | { timeZone: string; currency: 'GBP' }, budgets: [] as unknown[], entries: [] as unknown[], loading: false, fromCache: false, error: false };
vi.mock('../firebase/hooks', () => ({ useMoney: () => money }));

function Probe() {
  const m = usePocketMoney();
  return <p>{`${m.confirmed}|${m.isSetUp}|${m.timeZone}|${m.today}|${m.budgetFor('shared')?.id ?? '-'}`}</p>;
}

test('not set up until settings and budgets exist; falls back to London', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  render(<PocketMoneyProvider code="c"><Probe /></PocketMoneyProvider>);
  expect(screen.getByText('true|false|Europe/London|2026-10-16|-')).toBeInTheDocument();
  vi.useRealTimers();
});

test('uses the household time zone for today and finds budgets by owner', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T21:00:00Z'));
  money = {
    loading: false, fromCache: false, error: false, entries: [],
    settings: { timeZone: 'Asia/Tehran', currency: 'GBP' },
    budgets: [{ id: 'home', name: 'Home', owner: 'shared', monthlyAmount: 10000, penalty: false, order: 2, createdAt: 1, archivedAt: null }],
  };
  render(<PocketMoneyProvider code="c"><Probe /></PocketMoneyProvider>);
  expect(screen.getByText('true|true|Asia/Tehran|2026-10-17|home')).toBeInTheDocument();
  vi.useRealTimers();
});

test('an invalid stored time zone falls back to Europe/London', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  money = { loading: false, fromCache: false, error: false, entries: [], settings: { timeZone: 'Not/AZone', currency: 'GBP' }, budgets: [] };
  render(<PocketMoneyProvider code="c"><Probe /></PocketMoneyProvider>);
  expect(screen.getByText('true|false|Europe/London|2026-10-16|-')).toBeInTheDocument();
  vi.useRealTimers();
});

test('confirmed is false while the budgets snapshot is from cache, or after a listener error, or while loading', () => {
  const base = { settings: null, budgets: [], entries: [], loading: false, fromCache: false, error: false };
  const confirmedFor = (over: Partial<typeof base>) => {
    money = { ...base, ...over };
    const { unmount } = render(<PocketMoneyProvider code="c"><Probe /></PocketMoneyProvider>);
    const text = document.body.textContent!.split('|')[0];
    unmount();
    return text;
  };
  expect(confirmedFor({})).toBe('true');
  expect(confirmedFor({ fromCache: true })).toBe('false');
  expect(confirmedFor({ error: true })).toBe('false');
  expect(confirmedFor({ loading: true })).toBe('false');
});
