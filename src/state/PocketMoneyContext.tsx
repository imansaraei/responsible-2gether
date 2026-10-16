import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMoney } from '../firebase/hooks';
import { dayKeyIn, FALLBACK_TIME_ZONE, monthKeyOf } from '../domain/money';
import type { Budget, BudgetOwner, MoneyEntry } from '../domain/types';

export interface PocketMoneyCtx {
  loading: boolean;
  /** True only once the server has confirmed the data: not loading, not from the offline cache, no listener error. */
  confirmed: boolean;
  isSetUp: boolean;
  timeZone: string;
  today: string;
  budgets: Budget[];
  entries: MoneyEntry[];
  budgetFor(owner: BudgetOwner): Budget | undefined;
}

export const PocketMoneyContext = createContext<PocketMoneyCtx | null>(null);

function useToday(timeZone: string): string {
  const [today, setToday] = useState(() => dayKeyIn(new Date(), timeZone));
  useEffect(() => {
    const tick = () => setToday(dayKeyIn(new Date(), timeZone));
    tick();
    const t = setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [timeZone]);
  return today;
}

/** The stored zone is only length-validated by the rules, so an invalid one must not crash the app. */
function safeZone(tz: string | undefined): string {
  if (!tz) return FALLBACK_TIME_ZONE;
  try {
    dayKeyIn(new Date(), tz);
    return tz;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export function PocketMoneyProvider({ code, children }: { code: string; children: ReactNode }) {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(dayKeyIn(new Date(), FALLBACK_TIME_ZONE)));
  const { settings, budgets, entries, loading, fromCache, error } = useMoney(code, monthKey);
  const timeZone = safeZone(settings?.timeZone);
  const today = useToday(timeZone);
  useEffect(() => { if (monthKeyOf(today) !== monthKey) setMonthKey(monthKeyOf(today)); }, [today, monthKey]);

  const value = useMemo<PocketMoneyCtx>(() => ({
    loading,
    confirmed: !loading && !fromCache && !error,
    isSetUp: settings !== null && budgets.length > 0,
    timeZone, today, budgets, entries,
    budgetFor: (owner) => budgets.find((b) => b.owner === owner),
  }), [loading, fromCache, error, settings, budgets, entries, timeZone, today]);

  return <PocketMoneyContext.Provider value={value}>{children}</PocketMoneyContext.Provider>;
}

export function usePocketMoney(): PocketMoneyCtx {
  const ctx = useContext(PocketMoneyContext);
  if (!ctx) throw new Error('usePocketMoney outside PocketMoneyProvider');
  return ctx;
}
