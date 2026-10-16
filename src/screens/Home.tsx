import { useState } from 'react';
import { usePocketMoney } from '../state/PocketMoneyContext';
import { PurchaseSheet } from '../components/PurchaseSheet';
import { Toast, useToast } from '../components/Toast';
import { addMoneyEntry } from '../firebase/repo';
import { allowanceStatus, formatGBP } from '../domain/money';
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { summarizeWeek } from '../domain/weekSummary';
import { other } from '../domain/types';
import { exportReminderDue } from '../device';
import { memberColor } from '../components/colors';
import type { NavTarget } from '../navigation';

export function Home({ onNavigate }: { onNavigate(t: NavTarget): void }) {
  const { code, me, members, chores, currentWeekId, device } = useHousehold();
  const { completions, feedback, logs, loading } = useWeek(code, currentWeekId);
  const partner = other(me);
  const pm = usePocketMoney();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noSpendingFailed, setNoSpendingFailed] = useState(false);
  const { toast, show } = useToast();
  const myBudget = pm.budgetFor(me);
  const homeBudget = pm.budgetFor('shared');
  const partnerBudget = pm.budgetFor(partner);
  const moneyReady = pm.isSetUp && !!myBudget;
  const s = myBudget ? allowanceStatus(myBudget, pm.entries, pm.today) : null;
  const monthLeftOf = (b: typeof myBudget) => (b ? formatGBP(allowanceStatus(b, pm.entries, pm.today).monthLeft) : '—');

  function noSpending() {
    if (!myBudget) return;
    setNoSpendingFailed(false);
    addMoneyEntry(code, { budgetId: myBudget.id, by: me, day: pm.today, amount: 0, label: '', kind: 'nothing' }, crypto.randomUUID())
      .catch((err) => { console.error(err); setNoSpendingFailed(true); });
    show('Logged: no spending today');
  }

  const { pct, done } = summarizeWeek(currentWeekId, chores, completions, logs, true);
  const toActOn = feedback.filter((f) => f.kind === 'minus' && f.to === me && !f.resolved).length;
  const split = `You ${pct[me]}% · ${members[partner].name} ${pct[partner]}%`;

  return (
    <main className="page home">
      <header className="home-head">
        <h1>Khooneh</h1>
        <p className="muted">Hi {members[me].name}</p>
      </header>

      {!loading && toActOn > 0 && (
        <button className="notice notice-action" onClick={() => onNavigate({ tab: 'chores', section: 'todo' })}>
          {toActOn} feedback note{toActOn === 1 ? '' : 's'} to act on ›
        </button>
      )}
      {exportReminderDue(device.lastExportAt, Date.now()) && (
        <button className="notice notice-action" onClick={() => onNavigate({ tab: 'settings' })}>
          Back up your data ›
        </button>
      )}

      {moneyReady && s && (
        <section className="today-strip card" aria-label="My pocket money today">
          <div className="today-big"><strong className={s.todayLeft < 0 ? 'over' : ''}>{formatGBP(s.todayLeft)}</strong> <span>left today</span></div>
          <div className="muted small">{formatGBP(s.weekLeft)} this week · {formatGBP(s.monthLeft)} this month</div>
        </section>
      )}

      <div className={moneyReady ? 'home-actions two' : 'home-actions'}>
        {moneyReady && (
          <button className="btn primary big" onClick={() => setSheetOpen(true)}>＋ Purchase</button>
        )}
        <button className="btn primary big" onClick={() => onNavigate({ tab: 'chores', section: 'todo' })}>
          ＋ Chore
        </button>
      </div>
      {moneyReady && s && !s.loggedToday && (
        <button className="btn ghost no-spend" onClick={noSpending}>No spending today</button>
      )}
      {noSpendingFailed && <p role="alert" className="error small">Couldn’t log that. Try again.</p>}

      <button className="card module-card" onClick={() => onNavigate({ tab: 'chores', section: 'week' })}>
        <span className="module-card-title">🧺 Tidy Together <span aria-hidden="true">›</span></span>
        {loading ? (
          <span className="muted">Loading…</span>
        ) : done.total === 0 ? (
          <span className="muted">Nothing logged yet this week</span>
        ) : (
          <>
            <span>{split}</span>
            <span className="split-bar" aria-hidden="true">
              <span style={{ width: `${pct[me]}%`, background: memberColor(me) }} />
              <span style={{ width: `${pct[partner]}%`, background: memberColor(partner) }} />
            </span>
          </>
        )}
      </button>

      <button
        className="card module-card"
        onClick={() => onNavigate(moneyReady ? { tab: 'money', moneySection: 'family' } : { tab: 'money' })}
      >
        <span className="module-card-title">👛 Pocket Money <span aria-hidden="true">›</span></span>
        {pm.loading ? (
          <span className="muted">Loading…</span>
        ) : !pm.isSetUp ? (
          <span className="muted">{pm.confirmed ? 'Set up your allowances' : 'Connect to set up'}</span>
        ) : (
          <>
            <span>You {monthLeftOf(myBudget)} left</span>
            <span>{members[partner].name} {monthLeftOf(partnerBudget)} left</span>
            <span>Home {monthLeftOf(homeBudget)} left</span>
          </>
        )}
      </button>

      <PurchaseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSaved={show} />
      <Toast text={toast} />
    </main>
  );
}
