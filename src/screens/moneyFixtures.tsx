import type { ReactNode } from 'react';
import { HouseholdContext, type HouseholdCtx } from '../state/HouseholdContext';
import { PocketMoneyContext, type PocketMoneyCtx } from '../state/PocketMoneyContext';
import type { Budget, MoneyEntry } from '../domain/types';

export const household: HouseholdCtx = {
  code: 'c', me: 'b', currentWeekId: '2026-W42',
  members: { a: { name: 'Iman' }, b: { name: 'Tahereh' } },
  chores: [], device: { code: 'c', me: 'b', lastExportAt: Date.now() }, updateDevice: () => {},
};
export const budgets: Budget[] = [
  { id: 'personal-a', name: 'Iman', owner: 'a', monthlyAmount: 20000, penalty: true, order: 0, createdAt: Date.parse('2026-10-01T09:00:00Z'), archivedAt: null },
  { id: 'personal-b', name: 'Tahereh', owner: 'b', monthlyAmount: 25000, penalty: true, order: 1, createdAt: Date.parse('2026-10-01T09:00:00Z'), archivedAt: null },
  { id: 'home', name: 'Home', owner: 'shared', monthlyAmount: 10000, penalty: false, order: 2, createdAt: Date.parse('2026-10-01T09:00:00Z'), archivedAt: null },
];
export const money = (over: Partial<PocketMoneyCtx> = {}): PocketMoneyCtx => ({
  loading: false, confirmed: true, isSetUp: true, timeZone: 'Europe/London', today: '2026-10-16', budgets, entries: [],
  budgetFor: (o) => (over.budgets ?? budgets).find((b) => b.owner === o), ...over,
});
export const entry = (e: Partial<MoneyEntry> & Pick<MoneyEntry, 'id'>): MoneyEntry => ({
  budgetId: 'personal-b', by: 'b', day: '2026-10-16', amount: 500, label: 'Coffee', kind: 'purchase', createdAt: 1, ...e,
});
export function Providers({ children, ctx = money() }: { children: ReactNode; ctx?: PocketMoneyCtx }) {
  return (
    <HouseholdContext.Provider value={household}>
      <PocketMoneyContext.Provider value={ctx}>{children}</PocketMoneyContext.Provider>
    </HouseholdContext.Provider>
  );
}
